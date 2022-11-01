/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { createLRU } from 'lru2';
import { mapSeries } from 'bluebird';
import { knex, insertOrUpdate, getOne, update, initQuery, insertInto, getAllWhereIn, getOneWhere, rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { getLeaseTermsByPropertyIds } from './leaseTermRepo';
import config from '../config';
import { getLeasingOfficeAddress } from '../services/helpers/properties';
import { getTenantSettingsByIdQuery } from './tenantsRepo';
import { prepareRawQuery, common } from '../common/schemaConstants';
import { formatPropertyAssetUrl } from '../helpers/assets-helper';
import { createCteFromArray } from '../helpers/repoHelper';
import { emptyJsonbObj } from './helpers/common';
import loggerModule from '../../common/helpers/logger';
import { getCtxCache, setCtxCache } from '../../common/server/ctx-cache';

const logger = loggerModule.child({ subType: 'propertyRepo' });

// TODO: risky model because some servers may have an updated cache (when new settings are saved)
// while others won't know that there was a change, and some old values are going to remain in the cache.
// For these type of cahches (that are not limited to context), we should be using the distributed cache)
// This was mostly used for the timezone I believe, and maybe part of the settings that does not change
const propertyCache = createLRU({
  limit: 100,
  onRemoveEntry: entry => {
    entry.timezone = undefined;
    entry.settings = undefined;
  },
});

const getMarketingFilters = propertyAlias => {
  const alias = propertyAlias ? `"${propertyAlias}".` : '';
  return `(COALESCE(NULLIF(${alias}settings->'marketing'->>'includedInListings', ''), '0')::BOOLEAN IS TRUE AND ${alias}inactive IS FALSE)`;
};

const addMarketingFiltersToQueryBuilder = (query, propertyAlias) => {
  const statement = getMarketingFilters(propertyAlias);
  return query.whereRaw(statement);
};

export const saveProperty = async (ctx, property, options) => await insertOrUpdate(ctx, 'Property', property, options);

export const getPropertiesWithoutPropertyPartySettings = async ctx => {
  const query = `
    WITH "PartyTypes" (type) AS (values ('corporate'), ('traditional'))
    SELECT p.name, string_agg(pt.type, ', ') AS "missingSettings"
    FROM db_namespace."Property" p CROSS JOIN "PartyTypes" pt
    LEFT JOIN db_namespace."PropertyPartySettings" pps ON p.id=pps."propertyId" AND pt.type=pps."partyType"
    WHERE pps.id is null
    GROUP BY p.name
    ORDER BY p.name;
  `;
  const { rows } = await rawStatement(ctx, query);
  return rows;
};

// this method is used to construct the query
// so it might be ok to not use async/await
// eslint-disable-next-line red/dal-async
export const getProperties = (ctx, { includeMarketingFilters = false } = {}) => {
  const query = initQuery(ctx).from('Property');
  return includeMarketingFilters ? addMarketingFiltersToQueryBuilder(query) : query;
};

export const getMarketingPropertiesWithExtendedInformation = async (ctx, { propertyId, includeMarketingFilters = false } = {}) => {
  const propertyIdFilter = propertyId ? 'p.id = :propertyId' : '';
  const marketingFilters = includeMarketingFilters ? getMarketingFilters('p') : '';
  let whereCondition = [propertyIdFilter, marketingFilters].filter(it => it).join(' AND ');
  whereCondition = whereCondition ? `WHERE ${whereCondition}` : '';

  const query = `
  WITH property_layouts AS
  (
  SELECT ml."propertyId",
      array_agg(DISTINCT(l."numBedrooms"::NUMERIC)) AS "numBedrooms",
      MIN(l."surfaceArea") AS "minSurfaceArea",
      MAX(l."surfaceArea") AS "maxSurfaceArea"
  FROM :schema:."MarketingLayout" ml
      INNER JOIN :schema:."Layout" l ON l."marketingLayoutId" = ml."id"
  GROUP BY ml."propertyId"
  ), property_amenities AS
  (
  SELECT am."propertyId",
       json_agg(JSON_BUILD_OBJECT(
         'name', am.name,
         'displayName', am."displayName",
         'description', am.description,
         'order', am.order,
         'infographicName', am."infographicName" )) AS "lifestyles"
  FROM :schema:."Amenity" am
  WHERE am."subCategory" = '${DALTypes.AmenitySubCategory.LIFESTYLE}'
  AND am."endDate" IS NULL
  GROUP BY am."propertyId"
  )
  SELECT p.*,
       pl."numBedrooms",
       pl."minSurfaceArea",
       pl."maxSurfaceArea",
       pa."lifestyles"
  FROM :schema:."Property" p
      LEFT JOIN property_amenities pa ON p.id = pa."propertyId"
      LEFT JOIN property_layouts pl ON p.id = pl."propertyId"
  ${whereCondition}
  `;
  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, propertyId }]);
  return rows;
};

export const getOccupancyRate = async (ctx, propertyId) => {
  const query = `
  SELECT ROUND(COUNT(inv.id)::NUMERIC / (CASE COUNT(rms.id) WHEN 0 THEN 1 ELSE COUNT(rms.id) END), 2) AS "occupancyRate"
  FROM :schema:."Inventory" inv
  LEFT JOIN :schema:."RmsPricing" rms ON inv."id" = rms."inventoryId" AND rms."renewalDate" IS NULL
  WHERE inv."propertyId" = :propertyId
  AND inv."type" = '${DALTypes.InventoryType.UNIT}'
  `;
  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, propertyId }]);
  return rows[0] && rows[0].occupancyRate;
};

export const getPropertiesToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `Property.${field}`);
  const foreignKeysToSelect = [
    'PropertyGroup.name as propertyGroup',
    'Address.addressLine1 as addressLine1',
    'Address.addressLine2 as addressLine2',
    'Address.city as city',
    'Address.state as state',
    'Address.postalCode as postalCode',
  ];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('Property')
    .innerJoin('PropertyGroup', 'Property.propertyGroupId', 'PropertyGroup.id')
    .innerJoin('Address', 'Property.addressId', 'Address.id')
    .whereIn('Property.id', propertyIdsToExport);
};

const groupLifeStyles = lifeStyles =>
  lifeStyles.reduce((acc, lifestyle) => {
    acc[lifestyle.propertyId] = (acc[lifestyle.propertyId] || []).concat(lifestyle.displayName);
    return acc;
  }, {});

const groupAmenities = amenities =>
  amenities.reduce((acc, amenity) => {
    acc[amenity.propertyId] = (acc[amenity.propertyId] || []).concat({ name: amenity.displayName, isHighValue: amenity.isHighValue });
    return acc;
  }, {});

const groupFloors = floors =>
  floors.reduce((acc, floor) => {
    acc[floor.propertyId] = (acc[floor.propertyId] || []).concat(floor.floor);
    return acc;
  }, {});

const getLifeStylesByPropertyIds = async (ctx, propertyIds) => {
  const query = `
  SELECT am."propertyId", am."displayName"
  FROM :schema:."Amenity" am
  WHERE am."propertyId" = ANY (:propertyIds)
    AND am."category" = '${DALTypes.AmenityCategory.PROPERTY}'
    AND am."subCategory" = '${DALTypes.AmenitySubCategory.LIFESTYLE}'
    AND am."endDate" IS NULL
  `;
  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, propertyIds }]);
  return rows;
};

const getAmenitiesByPropertyIds = async (ctx, propertyIds) => {
  const query = `
  SELECT am."propertyId", am."displayName", am."highValue" as "isHighValue"
  FROM :schema:."Amenity" am
  WHERE am."propertyId" = ANY (:propertyIds)
    AND am."category" <> '${DALTypes.AmenityCategory.PROPERTY}'
    AND am."subCategory" <> '${DALTypes.AmenitySubCategory.LIFESTYLE}'
    AND am."hidden" = ${false}
    AND am."endDate" IS NULL
  ORDER BY am."highValue" DESC, am."displayName"
  `;
  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, propertyIds }]);
  return rows;
};

const getFloorsByPropertyIds = async (ctx, propertyIds) => {
  const query = `
    SELECT DISTINCT(inv."floor"), inv."propertyId"
    FROM :schema:."Inventory" inv
    WHERE inv."propertyId" = ANY (:propertyIds)
      AND inv."type" = 'unit'
      AND inv."floor" IS NOT NULL
    ORDER BY inv."floor"
  `;
  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, propertyIds }]);
  return rows;
};

const getTeamProperties = async (ctx, excludeInactiveTeams = true) => {
  const excludeInactiveTeamsFilter = excludeInactiveTeams ? 'WHERE t."endDate" IS NULL' : '';
  const query = `
    SELECT tp."propertyId", tp."teamId"
  FROM db_namespace."TeamProperties" tp
  INNER JOIN db_namespace."Teams" t on t.id = tp."teamId"
  ${excludeInactiveTeamsFilter}`;

  const { rows } = await rawStatement(ctx, query, []);
  return rows;
};

export const getPropertiesWithAmenitiesAndFloors = async (ctx, excludeInactiveTeams = true) => {
  const properties = await initQuery(ctx)
    .select('p.*', 'a.addressLine1', 'a.addressLine2', 'a.city', 'a.state', 'a.postalCode')
    .from('Property as p')
    .innerJoin('Address as a', 'p.addressId', 'a.id');

  const propertiesIds = properties.map(p => p.id);

  const lifeStyles = await getLifeStylesByPropertyIds(ctx, propertiesIds);
  const groupedLifeStyles = groupLifeStyles(lifeStyles);

  const amenities = await getAmenitiesByPropertyIds(ctx, propertiesIds);
  const groupedAmenities = await groupAmenities(amenities);

  const floors = await getFloorsByPropertyIds(ctx, propertiesIds);
  const groupedFloors = await groupFloors(floors);

  const teamProperties = await getTeamProperties(ctx, excludeInactiveTeams);
  const groupedTeamProperties = teamProperties.reduce((acc, curr) => {
    acc[curr.propertyId] = (acc[curr.propertyId] || []).concat(curr.teamId);
    return acc;
  }, {});

  const leaseTermsByProperty = (await getLeaseTermsByPropertyIds(ctx, propertiesIds)) || [];

  return await mapSeries(properties, async property => ({
    ...property,
    lifestyleDisplayNames: groupedLifeStyles[property.id] || [],
    amenities: groupedAmenities[property.id] || [],
    floors: groupedFloors[property.id] || [],
    leaseTerms: leaseTermsByProperty.filter(item => item.propertyId === property.id).map(item => omit(item, 'propertyId')),
    imageUrl: await formatPropertyAssetUrl(ctx, property.id),
    teamIds: groupedTeamProperties[property.id] || [],
    leasingOfficeAddress: getLeasingOfficeAddress({
      ...property,
      address: { addressLine1: property.addressLine1, city: property.city, state: property.state },
    }),
  }));
};

export const getLifeStylesForProperty = async (ctx, id) => {
  const lifeStyles = await getLifeStylesByPropertyIds(ctx, [id]);
  return groupLifeStyles(lifeStyles)[id] || [];
};

export const getPropertyByName = (ctx, propertyName) => getProperties(ctx).where('name', propertyName).first();

export const getPropertiesWhereNameIn = async (ctx, names) => await getProperties(ctx).whereIn('name', names);

export const getPropertiesIdsWhereNameIn = (ctx, names) => getProperties(ctx).whereIn('name', names).select('id');

const getOrderedPricesForProperties = async ({ tenantId: schema }, propertyNames = []) => {
  const results = await knex.raw(
    `
      SELECT DISTINCT COALESCE(rms."marketRent", 0) AS "marketRent",
      id AS "inventoryId"
      FROM :schema:."UnitSearch" us
      LEFT JOIN
      (
      SELECT
        rms."inventoryId",
        MAX(CASE WHEN "renewalDate" IS NULL THEN "standardRent" ELSE NULL END) AS "marketRent"
      FROM :schema:."RmsPricing" rms
      GROUP BY rms."inventoryId"
      ) rms ON rms."inventoryId" = us.id
      WHERE us."propertyName" = ANY( :propertyNamesParam) AND us.inventory_object->>'unitType' = 'unit'
      ORDER BY "marketRent";
  `,
    {
      schema,
      propertyNamesParam: [propertyNames],
    },
  );
  return (results && results.rows) || [];
};

export const getMinAndMaxRentRangeForProperties = async (ctx, propertyNames) => {
  const marketRents = await getOrderedPricesForProperties(ctx, propertyNames);
  if (!(marketRents && marketRents.length)) return [];

  const minimumMarketRent = marketRents.shift();
  const maximumMarketRent = marketRents.pop();
  return [minimumMarketRent, maximumMarketRent];
};

export const getProperty = async (ctx, id) => await getOne(ctx, 'Property', id);

// eslint-disable-next-line red/dal-async
export const getPropertyByIdQuery = (ctx, propertyId) => {
  if (ctx.tenantId === common.id) {
    return emptyJsonbObj;
  }

  return knex.raw(
    prepareRawQuery(
      `
    SELECT
      p.*,
      a."addressLine1",
      a."addressLine2",
      a.city,
      a.state,
      a."postalCode",
      (${getTenantSettingsByIdQuery(ctx.tenantId)}) as "tenantSettings"
    FROM db_namespace."Property" as p
    INNER JOIN db_namespace."Address" as a ON p."addressId" = a.id
    WHERE p.id = :propertyId`,
      ctx.tenantId,
    ),
    { propertyId },
  );
};

export const getPropertyById = async (ctx, id, expandFks = true) => {
  const fksToExpand = expandFks ? { addressId: { rel: 'Address', repr: 'address' } } : {};

  const property = await getOne(ctx, 'Property', id, fksToExpand);
  return property;
};

const getCachedProperty = propertyId => propertyCache.get(propertyId);
const setCachedProperty = (propertyId, propertyData) => propertyCache.set(propertyId, propertyData);

export const updateProperty = async (ctx, where, data) => {
  const shouldUpdatePropertyCache = Object.keys(data).some(key => key === 'settings' || key === 'timezone');
  const updatedProperty = await update(ctx.tenantId, 'Property', where, data);

  if (shouldUpdatePropertyCache && updatedProperty) {
    updatedProperty.forEach(property => {
      const { id, timezone, settings } = property || {};
      if (id && timezone && settings) {
        setCachedProperty(id, { timezone, settings });
      }
    });
  }

  return updatedProperty;
};

export const updatePropertiesSettingsWithSpecials = async (ctx, properties) => {
  logger.info({ ctx, properties }, 'Updating properties specials');

  const query = `
    UPDATE db_namespace."Property" as p
    SET settings = jsonb_set(settings, '{marketing,specials}', s.specials::jsonb)
    FROM (values
      ${properties.map(({ id, specials }) => `('${id}', '"${specials}"')`)}
    ) AS s (id, specials)
    WHERE s.id::uuid = p.id;
  `;
  await rawStatement(ctx, query);
};

export const updatePropertySettingsWithSpecialsById = async (ctx, property) => {
  logger.info({ ctx, property }, 'Updating property specials');

  const query = `
    UPDATE db_namespace."Property" as p
    SET settings = jsonb_set(settings, '{marketing,specials}', s.specials::jsonb)
    FROM (values ('${property.id}', '"${property.specials}"')
    ) AS s (id, specials)
    WHERE s.id::uuid = p.id;
  `;
  await rawStatement(ctx, query);
};

export const getPropertiesAssociatedWithTeams = async (ctx, teamIds) => {
  if (!teamIds.length) return [];

  const query = `
    SELECT p.*, pc.name as "partyCohortName", "TeamProperties"."teamId"
    FROM db_namespace."Property" as p
    INNER JOIN db_namespace."TeamProperties" ON p."id" = "TeamProperties"."propertyId"
    LEFT JOIN db_namespace."PartyCohort" pc ON p."partyCohortId" = pc.id
    WHERE "TeamProperties"."teamId" in (${teamIds.map(teamId => `'${teamId}'`).join(',')})
    AND p."endDate" IS NULL OR p."endDate" > now()
  `;

  const { rows = [] } = await rawStatement(ctx, query);
  return rows;
};

export const getPropertySettings = async (ctx, id) => {
  const property = await getOne(ctx, 'Property', id);
  return property ? property.settings : null;
};

export const getPropertySettingsByIds = async (ctx, propertiesIds) => {
  const where = {
    column: 'id',
    array: propertiesIds,
  };
  const result = await getAllWhereIn(ctx, 'Property', where, ['id', 'settings']);

  return (result && result.map(p => ({ ...p.settings, id: p.id }))) || [];
};

const loadPostMonthLog = async (ctx, filter) => {
  const query = initQuery(ctx).from('PostMonthLog');
  return await (filter ? filter(query) : query);
};

export const getPostMonthLogByPropertyAndPostMonth = async (ctx, propertyId, postMonth) =>
  await loadPostMonthLog(ctx, q => q.where('propertyId', propertyId).andWhere('postMonth', postMonth));

export const savePostMonthLog = (ctx, postMonthLog) => insertInto(ctx.tenantId, 'PostMonthLog', postMonthLog, { outerTrx: ctx.trx });

export const updatePostMonthLog = (ctx, postMonthLog) => update(ctx.tenantId, 'PostMonthLog', { id: postMonthLog.id }, postMonthLog, ctx.trx);

export const getPropertySettingsAndTimezone = async (ctx, propertyIds) => {
  if (!Array.isArray(propertyIds)) throw new Error('propertyIds must be an array');

  const query = `
    SELECT id, settings, timezone FROM db_namespace."Property"
    WHERE id = ANY(:propertyIds)
  `;

  const { rows } = await rawStatement(ctx, query, [{ propertyIds }]);

  return rows;
};

const getPropertyTimezoneAndsettingsAndCacheIt = async (ctx, propertyId) => {
  const res = await getPropertySettingsAndTimezone(ctx, [propertyId]);

  const { timezone, settings } = res?.[0] || {};

  if (timezone && settings) {
    setCachedProperty(propertyId, { timezone, settings });
  }

  return { timezone, settings };
};

export const getPropertyTimezone = async (ctx, propertyId) => {
  const property = getCachedProperty(propertyId);

  if (property?.timezone) {
    return property.timezone;
  }

  const { timezone } = await getPropertyTimezoneAndsettingsAndCacheIt(ctx, propertyId);
  return timezone;
};

export const getPropertyTimezoneAndSettingsFromInventoryId = async (ctx, inventoryId) => {
  const query = `
    SELECT p.id, p.timezone, p.settings
    FROM db_namespace."Property" p
    INNER JOIN db_namespace."Inventory" i ON i."propertyId"= p.id
    WHERE i.id = :inventoryId
  `;
  const { rows } = await rawStatement(ctx, query, [{ inventoryId }]);

  const propertyInfo = rows[0];
  setCachedProperty(propertyInfo.id, propertyInfo);
  return propertyInfo;
};

export const getPropertySettingsByKey = async (ctx, id, key) =>
  await getProperties(ctx)
    .where('id', id)
    .select(knex.raw(`"settings"->'${key}' as setting`))
    .first();

export const getPropertyByExternalId = async (ctx, externalId) => await getOneWhere(ctx, 'Property', { externalId });

export const getPropertyByPartyId = async (ctx, partyId) => {
  const query = `
    SELECT prop.*
    FROM db_namespace."Property" prop
    INNER JOIN db_namespace."Party" p on p."assignedPropertyId" = prop."id"
    WHERE p."id" = :partyId`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows[0] || {};
};

export const getPropertiesByExternalIds = async (ctx, externalIds) => await getAllWhereIn(ctx, 'Property', { column: 'externalId', array: externalIds });

export const getPropertiesByNames = async (ctx, names) => await getAllWhereIn(ctx, 'Property', { column: 'name', array: names });

export const getPropertyByRmsExternalId = async (ctx, rmsExternalId) => {
  const cachePath = `dal.properties.rmsExternalId.${rmsExternalId}`;
  const propertyLocalCache = getCtxCache(ctx, cachePath);
  if (propertyLocalCache) {
    return propertyLocalCache;
  }

  const result = await getOneWhere(ctx, 'Property', { rmsExternalId });
  setCtxCache(ctx, cachePath, result);
  return result;
};

export const getPropertiesByQuotePricingSetting = async (ctx, unitPricing = false) => {
  const query =
    "SELECT * FROM db_namespace.\"Property\" WHERE COALESCE(NULLIF(settings->'integration'->'import'->>'unitPricing', ''), 'false')::boolean = :unitPricing";
  const { rows } = await rawStatement(ctx, query, [{ unitPricing }]);
  return rows;
};
export const getTeamCalendarSlotDuration = async (ctx, propertyId) => {
  const { setting } = await getPropertySettingsByKey(ctx, propertyId, 'calendar');
  return setting ? setting.teamSlotDuration : config.calendar.defaultTeamSlotDuration;
};

export const getPropertySettingsToExport = async (ctx, propertyIdsToExport) => {
  const allFieldsToSelect = ['name', 'settings'];

  return await initQuery(ctx).select(allFieldsToSelect).from('Property').whereIn('id', propertyIdsToExport);
};

export const getAllPropertySettingsByKey = async (ctx, key) => {
  const query = `
  SELECT p."settings"->'${key}' as settings
  FROM db_namespace."Property" p
  ORDER BY created_at DESC
  `;
  const { rows } = await rawStatement(ctx, query);
  return rows || [];
};

export const updatePropertyProviders = async (ctx, paymentProviders) => {
  const cteName = 'cte_paymentProviders';
  const cteColumnsNames = ['id', 'paymentProvider'];
  const paymentProvidersCteQuery = createCteFromArray(paymentProviders, cteName, cteColumnsNames);

  const query = `
      ${paymentProvidersCteQuery}
      )
      UPDATE db_namespace."Property" p
      SET  "${cteColumnsNames[1]}" = to_jsonb(cte."paymentProvider"::jsonb)
      FROM "${cteName}" cte
      WHERE p.id::text = cte.id`;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const saveIntegrationSetting = async (ctx, propertyId, integrationSetting) => {
  const query = `
    UPDATE db_namespace."Property"
    SET settings = jsonb_set(settings, '{integration}', :integrationSetting::jsonb, true)
    WHERE id = :propertyId
    RETURNING id, settings, timezone`;

  const { rows = [] } = await rawStatement(ctx, query, [{ propertyId, integrationSetting }]);
  const updatedProperty = rows[0];

  if (updatedProperty) {
    const { id, settings, timezone } = updatedProperty;
    setCachedProperty(id, { settings, timezone });
  }
  return updatedProperty;
};

export const saveRxpSettings = async (ctx, propertyId, rxpSettings) => {
  const query = `
    UPDATE db_namespace."Property"
    SET settings = jsonb_set(settings, '{rxp}', :rxpSettings::jsonb, true)
    WHERE id = :propertyId
    RETURNING id, settings, timezone`;

  const { rows = [] } = await rawStatement(ctx, query, [{ propertyId, rxpSettings }]);
  const updatedProperty = rows[0];

  if (updatedProperty) {
    const { id, settings, timezone } = updatedProperty;
    setCachedProperty(id, { settings, timezone });
  }
  return updatedProperty;
};

export const getUpdatedPropertyId = async (ctx, originalPropertyId) => {
  const query = `
    SELECT m.sal_id FROM db_namespace.mapping m
    WHERE m.table_name = 'Property'
    AND m.customerold_id = :originalPropertyId
  `;
  const { rows } = await rawStatement(ctx, query, [{ originalPropertyId }]);
  const mapping = rows[0] || {};

  return mapping.sal_id || originalPropertyId;
};

export const getPropertyAddress = async (ctx, propertyId) => {
  const query = `
    SELECT a."addressLine1", a."addressLine2", a."city", a."state", a."postalCode"
    FROM db_namespace."Address" a
    INNER JOIN db_namespace."Property" p on p."addressId" = a."id"
    WHERE p."id" = :propertyId
    `;

  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows[0] || {};
};

export const existPropertyWithInventoryStateEnabled = async ctx => {
  const query = `
    SELECT (
      EXISTS (
        SELECT 1
        FROM db_namespace."Property" p
        WHERE (p.settings->'integration'->'import'->>'inventoryState')::boolean = true
      )
    )
    `;

  const { rows = [] } = await rawStatement(ctx, query);
  return (rows[0] || {}).exists;
};

export const getPropertiesToUpdateFromDB = async ctx => {
  const query = `
  SELECT name FROM db_namespace."Property"
  WHERE (settings->'integration'->'import'->>'inventoryState')::bool = true;
  `;
  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const isPropertyInactive = async (ctx, propertyId) => {
  const query = `
    SELECT (
      EXISTS (
        SELECT 1
        FROM db_namespace."Property"
        WHERE id = :propertyId AND (inactive = true OR "endDate" <= now())
      )
    )
    `;

  const { rows = [] } = await rawStatement(ctx, query, [{ propertyId }]);

  return rows?.[0]?.exists;
};

export const getActiveProperties = async ctx => {
  const query = `
    SELECT * FROM db_namespace."Property" p WHERE "endDate" IS NULL OR "endDate" > now();
  `;

  const { rows = [] } = await rawStatement(ctx, query);

  return rows;
};

export const getNewInactiveProperties = async ctx => {
  const query = `
    SELECT p.*
    FROM db_namespace."Property" p
      WHERE p.inactive IS TRUE
      AND (p."endDate"::date = NOW()::date OR p."endDate"::date = (NOW() - INTERVAL '1 day')::date)
  `;

  const { rows } = await rawStatement(ctx, query, []);
  return rows || [];
};

export const getPropertiesWithAmenityImportEnabled = async (ctx, includeInactive = false) => {
  const cachePath = `dal.property.getPropertiesWithAmenityImportEnabled.${includeInactive}`;
  const propertiesWithAmenityImportEnabled = getCtxCache(ctx, cachePath);
  if (propertiesWithAmenityImportEnabled) {
    return propertiesWithAmenityImportEnabled;
  }
  const includeInactiveCondition = includeInactive ? '' : ' AND p.inactive = false';
  const query = `
    SELECT id, name FROM db_namespace."Property" p
    WHERE (p.settings->'integration'->'import'->>'amenities')::boolean = true
    ${includeInactiveCondition}
  `;
  const { rows = [] } = await rawStatement(ctx, query);
  setCtxCache(ctx, cachePath, rows);
  return rows;
};

const leaseSettingsCachePath = propertyId => `dal.properties[${propertyId}].leaseSettings`;

// Ideally, we should be using settigns directly, and have a good cache that gets invalidated when settings are getting updated
// As we don't have, for now, we have to deal with lower level function where we may request data that s alsready cahced as part of teh settings
export const saveLeaseOauthToken = async (ctx, propertyId, oauth) => {
  const query = `
    UPDATE db_namespace."Property"
    SET settings = jsonb_set(settings, '{lease, oauth}', :oauth::jsonb, true)
    WHERE id = :propertyId
    RETURNING id, settings, timezone`;

  const { rows = [] } = await rawStatement(ctx, query, [{ propertyId, oauth }]);
  const updatedProperty = rows[0];

  if (updatedProperty) {
    const { id, settings, timezone } = updatedProperty;
    setCachedProperty(id, { settings, timezone });
    setCtxCache(ctx, leaseSettingsCachePath(id), settings.lease);
  }
  return updatedProperty;
};

export const getLeaseSettings = async (ctx, id) => {
  const cachedLeaseSettings = getCtxCache(ctx, leaseSettingsCachePath(id));
  if (cachedLeaseSettings) {
    return cachedLeaseSettings;
  }

  const { setting: leaseSettings } = await getPropertySettingsByKey(ctx, id, 'lease');
  setCtxCache(ctx, leaseSettingsCachePath(id), leaseSettings);
  return leaseSettings;
};
