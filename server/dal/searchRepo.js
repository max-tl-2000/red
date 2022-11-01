/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { knex, initQuery, rawStatement, buildInClause } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { getTeamsForUser } from './teamsRepo';
import { getPropertiesAssociatedWithTeams } from './propertyRepo';
import { SEARCH_LIMIT_RESULTS } from '../../common/helpers/utils';
import { isEmailAddress, isPhoneNo } from '../helpers/searchUtils';
import { formatPhoneNumberForDb } from '../helpers/phoneUtils';
import { getFullInventoryName } from './inventoryRepo';
import Diacritics from '../../common/helpers/diacritics';
import loggerModule from '../../common/helpers/logger';
import { getMinValue } from '../../common/helpers/number';
import { DASHES, WHITESPACES, NON_ALPHANUMERIC_AND_ALLOWED_SPECIAL_CHARS } from '../../common/regex';

const logger = loggerModule.child({ subType: 'dal/searchRepo' });

export const refreshUnitSearchView = async ctx => {
  const query = 'REFRESH MATERIALIZED VIEW db_namespace."UnitSearch";';
  await rawStatement(ctx, query);

  logger.trace({ ctx }, 'Refreshed UnitSearch Materialized View');
};

export const disableSearchTriggers = async schema =>
  await knex.raw(
    `
    ALTER TABLE :schema:."Person" DISABLE TRIGGER USER;
    ALTER TABLE :schema:."Party" DISABLE TRIGGER USER;
    ALTER TABLE :schema:."ContactInfo" DISABLE TRIGGER USER;
    ALTER TABLE :schema:."PartyMember" DISABLE TRIGGER USER;
  `,
    { schema },
  );

export const enableSearchTriggers = async schema =>
  await knex.raw(
    `
    ALTER TABLE :schema:."Person" ENABLE TRIGGER USER;
    ALTER TABLE :schema:."Party" ENABLE TRIGGER USER;
    ALTER TABLE :schema:."ContactInfo" ENABLE TRIGGER USER;
    ALTER TABLE :schema:."PartyMember" ENABLE TRIGGER USER;
  `,
    { schema },
  );

export const refreshSearchData = async schema =>
  await knex.raw(
    `
  SELECT FROM :schema:.generatepartysearchdata();
  SELECT FROM :schema:.generatepersonsearchdata();
`,
    { schema },
  );

const processFilters = filters => {
  const numBedrooms =
    filters.numBedrooms && filters.numBedrooms.length ? filters.numBedrooms.map(b => DALTypes.QualificationQuestions.BedroomOptions[b]).filter(b => b) : [];
  const inventoryIds = filters.inventoryIds;
  const numBathrooms = filters.numBathrooms ? filters.numBathrooms.replace('+', '') : '';
  const amenities = filters.amenities && filters.amenities.items && filters.amenities.items.length ? filters.amenities.items.map(item => item.text) : [];
  const selectedProperties = filters.propertyIds || [];
  const minPrice = (filters.marketRent && filters.marketRent.min) || -1;
  const maxPrice = (filters.marketRent && filters.marketRent.max) || -1;
  const floor = filters.floor && filters.floor.length ? filters.floor : [];
  const unitName = filters.unitName ? `%${filters.unitName.toLowerCase().trim()}%` : '';
  const maxMoveInDate = filters.moveInDate && filters.moveInDate.max;

  return {
    ...filters,
    numBedrooms,
    numBathrooms,
    amenities,
    minPrice,
    maxPrice,
    floor,
    selectedProperties,
    unitName,
    maxMoveInDate,
    inventoryIds,
    unitsInLayout: filters.unitsInLayout || false,
    maxVacantReadyUnits: filters.maxVacantReadyUnits ? Number(filters.maxVacantReadyUnits) : null,
    limit: filters.limit ? Number(filters.limit) : SEARCH_LIMIT_RESULTS,
  };
};

const buildTaggedUnitsCondition = taggedUnits =>
  `EXISTS (SELECT 1 FROM unnest(string_to_array('${taggedUnits.toString()}',',')) AS tagged WHERE units.id::text = tagged)`;

const getWhereClauseForSelections = ({ numBedrooms, amenities, floor, minPrice, maxPrice, maxMoveInDate }) => {
  const moveInDateMaxFilter = maxMoveInDate ? 'AND units."nextStateExpectedDate" <= (:maxMoveInDate)::timestamptz' : '';

  return `WHERE units."propertyId" = ANY(:selectedProperties::uuid[])
    ${numBedrooms.length ? 'AND units."numBedrooms" = ANY(:numBedrooms) ' : ''}
    ${amenities.length ? 'AND "amenities" @> :amenities' : ''}
    ${floor.length ? 'AND units."floor" = ANY(:floor) ' : ''}
    ${minPrice !== -1 ? 'AND units."marketRent"::decimal >= :minPrice::decimal ' : ''}
    ${maxPrice !== -1 ? 'AND units."marketRent"::decimal <= :maxPrice::decimal ' : ''}
    ${moveInDateMaxFilter}`;
};

const buildUnitSearchWhereClause = processedFilters => {
  const { favoriteUnits, unitName, taggedUnits, selectedProperties, inventoryIds } = processedFilters;
  let whereClause = '';
  const favoritesCondition = (favoriteUnits && favoriteUnits.length && `units.id IN (${favoriteUnits.map(id => `'${id}'`)})`) || 'false';

  if (inventoryIds && inventoryIds.length) {
    return `WHERE units.id IN (${inventoryIds.map(id => `'${id}'`)}) AND units."marketRent" IS NOT NULL`;
  }

  if (unitName && favoriteUnits) {
    whereClause = `WHERE (LOWER(units."fullQualifiedName") LIKE :unitNameFilter OR ${favoritesCondition})`;
  } else if (unitName && selectedProperties && selectedProperties.length) {
    whereClause = 'WHERE LOWER(units."fullQualifiedName") LIKE :unitNameFilter AND units."propertyId" = ANY(:selectedProperties::uuid[])';
  } else if (unitName) {
    whereClause = 'WHERE LOWER(units."fullQualifiedName") LIKE :unitNameFilter';
  } else if (favoriteUnits) {
    whereClause = `WHERE ${favoritesCondition}`;
  }

  if (taggedUnits) {
    whereClause = `${whereClause} OR ${buildTaggedUnitsCondition(taggedUnits.map(taggedUnit => taggedUnit.id))}`;
  }

  if (!unitName && !favoriteUnits && !taggedUnits) {
    whereClause = getWhereClauseForSelections(processedFilters);
  }

  return whereClause;
};

const buildInventoryStateClause = processedFilters => {
  if (processedFilters.unitName || (processedFilters.favoriteUnits && processedFilters.favoriteUnits.length)) {
    return '';
  }

  return `AND i.state = ANY( :inventoryStates)
          AND (i.state != :modelState OR (i.state = :modelState AND i."propertyId" = ANY(:selectedProperties ::uuid[])))`;
};

const buildRowNumberClause = ({ query, unitsInLayout = false }) => {
  const partitionByClause = unitsInLayout ? 'PARTITION BY "units"."partitionBy"' : '';

  let orderBy = 'ORDER BY';
  if (unitsInLayout) {
    orderBy = `${orderBy} "units"."lossLeaderUnit", "units"."availabilityDate"`;
  } else if (query) {
    orderBy = `${orderBy} "rank" DESC,
    "units"."fullQualifiedName" ASC`;
  } else {
    orderBy = `${orderBy}
    "units"."state" = '${DALTypes.InventoryState.MODEL}' DESC,
    "units"."lowestMonthlyRent"::decimal ASC,
    "units"."marketRent" ASC,
    "units"."name" ASC`;
  }

  return `ROW_NUMBER() OVER (${partitionByClause} ${orderBy}) AS "rowNumber"`;
};

const buildLimitWhereClause = ({ limit, withoutLimit, maxVacantReadyUnits }) => {
  if (withoutLimit) return '';

  if (!maxVacantReadyUnits) return `WHERE u."rowNumber" <= ${limit}`;

  return `WHERE CASE
      WHEN u.state = :vacantReadyState AND u."rowNumber" <= ${getMinValue(limit, maxVacantReadyUnits)} THEN 1
      WHEN u.state != :vacantReadyState AND u."rowNumber" <= ${limit} THEN 1
      ELSE 0
    END = 1`;
};

export const enhanceExactOrPartialQuery = (query, isExact = true, justWords = false) => {
  const justWordsQuery = query.replace(DASHES, ' ').replace(NON_ALPHANUMERIC_AND_ALLOWED_SPECIAL_CHARS, ' ').replace(WHITESPACES, ' ').trim().split(' ');
  const partialQuery = justWordsQuery.map(item => item && item.concat(':*'));

  if (justWords) {
    return justWordsQuery;
  }
  if (isExact) {
    return justWordsQuery.join(' & ');
  }
  return partialQuery.join(' & ');
};

export const enhanceQueryWords = query =>
  query.replace(DASHES, ' ').replace(NON_ALPHANUMERIC_AND_ALLOWED_SPECIAL_CHARS, ' ').replace(WHITESPACES, ' ').trim().split(' ');

export const enhanceQuery = (query = '') =>
  query
    .replace(DASHES, ' ')
    .replace(NON_ALPHANUMERIC_AND_ALLOWED_SPECIAL_CHARS, ' ')
    .replace(WHITESPACES, ' ')
    .trim() // we need to trim at the end to avoid `| :*` as part of the result and because it throws a syntax error in tsquery
    .split(' ')
    .map(item => item && item.concat(':*'))
    .join(' | ');

export const searchRankedValues = () => ({
  exactValue: 200,
  wordRank: 100,
  partialValue: 10,
});

const getPropertiesForSearch = async (ctx, userId) => {
  const teams = await getTeamsForUser(ctx, userId);
  const properties = await getPropertiesAssociatedWithTeams(
    ctx,
    teams.map(team => team.id),
  );

  return properties.map(property => property.id);
};

const buildQueryFromClause = query => {
  if (!query) return '';
  return `, to_tsquery('pg_catalog.english', '${enhanceQuery(query)}') AS query `;
};

const buildRankField = query => {
  if (!query) return '';
  return 'ts_rank("unitSearch"."globalSearchVector", query) AS rank,';
};

const buildQueryWhereClause = query => {
  if (!query) return '';
  return 'AND ("unitSearch"."globalSearchVector" @@ query)';
};

const getInventoryStatesFromFilter = ({ inventoryStates, unitName }) => {
  if (inventoryStates && inventoryStates.length && !unitName) {
    return inventoryStates;
  }
  return [
    DALTypes.InventoryState.OCCUPIED_NOTICE,
    DALTypes.InventoryState.VACANT_MAKE_READY,
    DALTypes.InventoryState.VACANT_READY,
    DALTypes.InventoryState.MODEL,
  ];
};

const createQueryStatement = (addPhoneSearch, query = '', wordsToMatch = []) => {
  const enhancedQuery = enhanceQuery(query);
  const enhancedExactQuery = enhanceExactOrPartialQuery(query);
  const enhancedPartialQuery = enhanceExactOrPartialQuery(query, false);
  const phoneStatement = ` ts_rank(to_tsvector(ps."searchVector"), query) AS phoneRank,
  ts_rank(to_tsvector(ps."phoneSearchVector"), query2) AS phoneRankExact,
  ${wordsToMatch.map((word, index) => `ts_rank(to_tsvector(ps."phoneSearchVector"), queryWord${index}) AS phoneRankWord${index}`)},
  ts_rank(to_tsvector(ps."phoneSearchVector" ), query3 ) AS phoneRankPartial`;

  return `ts_rank(to_tsvector(ps."searchVector"), query) AS rank,
  ts_rank(to_tsvector(ps."searchVector"), query2) AS rankExact,
  ${wordsToMatch.map((word, index) => `ts_rank(to_tsvector(ps."searchVector"), queryWord${index}) AS rankWord${index}`)},
  ts_rank(to_tsvector(ps."searchVector" ), query3 ) AS rankPartial   ${addPhoneSearch ? `, ${phoneStatement}` : ''}
  FROM to_tsquery('pg_catalog.english', '${enhancedQuery}') AS query,
  to_tsquery('pg_catalog.english','${enhancedExactQuery}') AS query2,
  to_tsquery('pg_catalog.english','${enhancedPartialQuery}') AS query3,
  ${wordsToMatch.map((word, index) => `to_tsquery('pg_catalog.english', '${word}') AS queryWord${index}`)},`;
};

const sortUnitsByTaggedDate = (taggedUnits, current, next) => {
  const currentTaggedUnit = taggedUnits.find(taggedUnit => taggedUnit.id === current.inventoryObject.id);
  const nextTaggedUnit = taggedUnits.find(tu => tu.id === next.inventoryObject.id);

  if (currentTaggedUnit && nextTaggedUnit) {
    return currentTaggedUnit.taggedAt > nextTaggedUnit.taggedAt ? -1 : 1;
  }
  return currentTaggedUnit || nextTaggedUnit ? 1 : 0;
};

const hasVacantReadyState = ({ state }) => state === DALTypes.InventoryState.VACANT_READY;

const removeExtraUnitsIfNeeded = (units, { maxVacantReadyUnits, limit }) => {
  if (!maxVacantReadyUnits) return units;

  const vacantReadyLength = units.filter(hasVacantReadyState).length;
  let noVacantReadyUnitsCount = 0;
  const maxNoVacantReadyUnitsLength = limit - vacantReadyLength;
  return units.reduce((acc, item) => {
    let shouldIncludeRecord = hasVacantReadyState(item);
    if (!shouldIncludeRecord && noVacantReadyUnitsCount < maxNoVacantReadyUnitsLength) {
      noVacantReadyUnitsCount++;
      shouldIncludeRecord = noVacantReadyUnitsCount <= maxNoVacantReadyUnitsLength;
    }

    shouldIncludeRecord && acc.push(item);
    return acc;
  }, []);
};

export const getRankedUnits = async (ctx, filters, currentUserId) => {
  const processedFilters = processFilters(filters);
  const whereClause = buildUnitSearchWhereClause(processedFilters);
  const inventoryStateClause = buildInventoryStateClause(processedFilters);
  const rowNumberClause = buildRowNumberClause(processedFilters);
  const queryFromClause = buildQueryFromClause(processedFilters.query);
  const rankField = buildRankField(processedFilters.query);
  const queryWhereClause = buildQueryWhereClause(processedFilters.query);
  const { numBedrooms, numBathrooms, minPrice, maxPrice, amenities, selectedProperties, floor, unitName: unitNameFilter, inventoryIds } = processedFilters;

  const statement = `WITH "units" AS (
     SELECT i.id,
            i."buildingId" AS "buildingId",
            i."inventoryGroupId" AS "inventoryGroupId",
            i."propertyId" AS "propertyId",
            i."layoutId" AS "layoutId",
            i."floor",
            i."address",
            i."state" as "state",
            i."externalId" as "externalId",
            i."stateStartDate" AS "stateStartDate",
            ig."leaseNameId" AS "leaseNameId",
            ig."feeId" AS "feeId",
            "unitSearch".inventory_object || jsonb_build_object(
              'marketRent', rms."marketRent",
              'priceAvailabilityDate', rms."priceAvailabilityDate",
              'lowestMonthlyRent', rms."lowestMonthlyRent",
              'renewalMarketRent', rms."renewalMarketRent",
              'renewalLowestMonthlyRent', rms."renewalLowestMonthlyRent",
              'minRentLeaseLength', rms."minRentLeaseLength",
              'renewalMinRentLeaseLength', rms."renewalMinRentLeaseLength",
              'renewalDate', rms."renewalDate"
            ) AS "inventoryObject",
            rms."marketRent",
            rms."priceAvailabilityDate",
            rms."lowestMonthlyRent",
            "unitSearch".inventory_object ->> 'layoutNoBedrooms' AS "numOfBedrooms",
            "unitSearch"."fullQualifiedName",
            "layout"."numBedrooms" AS "numBedrooms",
            ${rankField}
            i.name,
            i.type,
            i."availabilityDate",
            i."lossLeaderUnit",
            p.timezone,
            p."settings"->'integration'->'import'->>'inventoryAvailabilityDate' as "availabilityDateSource",
            (p."settings"->'inventory'->>'hideStateFlag')::bool as "hideStateFlag",
            CASE
              WHEN i."availabilityDate" IS NOT NULL THEN i."availabilityDate"
              ELSE CAST(i."stateStartDate" AS TIMESTAMP)
            END AS "nextStateExpectedDate",
            CASE
              WHEN i."state" = :vacantReadyState THEN i."state"
              ELSE ''
            END "partitionBy"
    FROM db_namespace."Inventory" AS i
    INNER JOIN db_namespace."UnitSearch" AS "unitSearch" ON i."id"="unitSearch"."id"
    INNER JOIN db_namespace."Layout" AS layout ON i."layoutId"=layout."id"
    INNER JOIN db_namespace."Property" AS p ON i."propertyId"=p."id"
    INNER JOIN db_namespace."InventoryGroup" AS ig ON i."inventoryGroupId"=ig."id"
    LEFT JOIN
    (
    SELECT
      rms."inventoryId",
      ROUND(MAX(CASE WHEN "renewalDate" IS NULL THEN "standardRent" ELSE NULL END)) AS "marketRent",
      MAX(CASE WHEN "renewalDate" IS NULL THEN "availDate" ELSE NULL END) AS "priceAvailabilityDate",
      ROUND(MAX(CASE WHEN "renewalDate" IS NULL THEN "minRent" ELSE NULL END)) AS "lowestMonthlyRent",
      ROUND(MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "standardRent" ELSE NULL END)) AS "renewalMarketRent",
      ROUND(MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "minRent" ELSE NULL END)) AS "renewalLowestMonthlyRent",
      MAX(CASE WHEN "renewalDate" IS NULL THEN "minRentLeaseLength" ELSE NULL END) AS "minRentLeaseLength",
      MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "minRentLeaseLength" ELSE NULL END) AS "renewalMinRentLeaseLength",
      MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "renewalDate" ELSE NULL END) AS "renewalDate"
    FROM db_namespace."RmsPricing" rms
    GROUP BY rms."inventoryId"
    ) rms ON rms."inventoryId" = i.id
    ${queryFromClause}
    WHERE i.type = :inventoryType ${inventoryStateClause}
    AND i.inactive = false
    ${queryWhereClause}
  ),
  "inventoryAmenities" AS (
    SELECT "displayName", ia."inventoryId" AS "inventoryId" FROM db_namespace."Amenity" a
      JOIN db_namespace."Inventory_Amenity" ia ON ia."amenityId" = a."id" AND ia."endDate" IS NULL
      WHERE a."propertyId" = ANY(:selectedProperties::uuid[]) AND a."endDate" IS NULL
  ),
  "buildingAmenities" AS (
    SELECT "displayName", i."id" AS "inventoryId" FROM db_namespace."Amenity" a
      JOIN db_namespace."Building_Amenity" ba ON ba."amenityId" = a."id"
      JOIN db_namespace."Inventory" i ON i."buildingId" = ba."buildingId"
      WHERE a."propertyId" = ANY(:selectedProperties::uuid[]) AND a."endDate" IS NULL
  ),
  "inventoryGroupAmenities" AS (
    SELECT "displayName", i."id" AS "inventoryId" FROM db_namespace."Amenity" a
      JOIN db_namespace."InventoryGroup_Amenity" iga ON iga."amenityId" = a."id"
      JOIN db_namespace."Inventory" i ON i."inventoryGroupId"= iga."inventoryGroupId"
      WHERE a."propertyId" = ANY(:selectedProperties::uuid[]) AND a."endDate" IS NULL
  ),
  "layoutAmenities" AS (
    SELECT "displayName", i.id AS "inventoryId" from db_namespace."Amenity" a
      JOIN db_namespace."Layout_Amenity" la ON la."amenityId" = a.ID
      JOIN db_namespace."Inventory" i ON i."layoutId" = la."layoutId"
      WHERE a."propertyId" = ANY(:selectedProperties::uuid[]) AND a."endDate" IS NULL
  ),
  "unitsWithAmenities" AS (
     SELECT ARRAY_AGG("displayName") AS "amenities", "inventoryId" FROM (
      SELECT * FROM "inventoryAmenities"
      UNION
      SELECT * FROM "buildingAmenities"
      UNION
      SELECT * FROM "inventoryGroupAmenities"
      UNION
      SELECT * from "layoutAmenities") r
     GROUP BY "inventoryId"
  )
  SELECT
    u."inventoryObject",
    u."buildingId",
    u."inventoryGroupId",
    u."propertyId",
    u."layoutId",
    u."leaseNameId",
    u."externalId",
    u."feeId",
    u."fullQualifiedName",
    u."availabilityDate",
    u."lossLeaderUnit",
    u."hideStateFlag",
    u."availabilityDateSource",
    u."state",
    u."stateStartDate",
    u."address",
    u."nextStateExpectedDate"
  FROM (
    SELECT "units"."inventoryObject" AS "inventoryObject",
      "units"."buildingId" AS "buildingId",
      "units"."inventoryGroupId" AS "inventoryGroupId",
      "units"."propertyId" AS "propertyId",
      "units"."layoutId" AS "layoutId",
      "units"."leaseNameId" AS "leaseNameId",
      "units"."feeId" AS "feeId",
      "units"."fullQualifiedName",
      "units"."externalId",
      "units"."availabilityDate",
      "units"."lossLeaderUnit",
      "units"."hideStateFlag",
      "units"."availabilityDateSource",
      "units"."state",
      "units"."stateStartDate",
      "units"."nextStateExpectedDate",
      "units"."address",
      ${rowNumberClause}
    FROM "units"
    left join "unitsWithAmenities" on "units"."id" = "unitsWithAmenities"."inventoryId"
    ${whereClause}
  ) AS u ${buildLimitWhereClause(processedFilters)}`;

  const results = await rawStatement(ctx, statement, [
    {
      numBedrooms,
      numBathrooms,
      minPrice,
      maxPrice,
      amenities,
      currentUserId,
      selectedProperties: selectedProperties.length
        ? selectedProperties
        : ((processedFilters.unitName || processedFilters.query || processedFilters.inventoryStates) && (await getPropertiesForSearch(ctx, currentUserId))) ||
          [],
      floor,
      unitNameFilter,
      inventoryType: DALTypes.InventoryType.UNIT,
      modelState: DALTypes.InventoryState.MODEL,
      vacantReadyState: DALTypes.InventoryState.VACANT_READY,
      inventoryStates: getInventoryStatesFromFilter(processedFilters),
      maxMoveInDate: processedFilters.maxMoveInDate,
      inventoryIds,
    },
  ]);

  if (results && results.rows) {
    const units = processedFilters.taggedUnits
      ? results.rows.sort((current, next) => sortUnitsByTaggedDate(processedFilters.taggedUnits, current, next))
      : results.rows;

    return removeExtraUnitsIfNeeded(units, processedFilters);
  }
  return [];
};

export const searchUnits = async (schema, query) => {
  let units;
  if (query) {
    units = `SELECT inventory_object AS "inventoryObject",
        "fullQualifiedName",
        CASE
          WHEN i."availabilityDate" IS NOT NULL THEN i."availabilityDate"
          ELSE CAST(i."stateStartDate" AS TIMESTAMP)
        END AS "nextStateExpectedDate",
        p."settings"->'integration'->'import'->>'inventoryAvailabilityDate' as "availabilityDateSource",
        (p.settings->'inventory'->>'hideStateFlag')::bool as "hideStateFlag",
        ts_rank("globalSearchVector", query) AS rank,
        i."state" as "state",
        i."stateStartDate" as "stateStartDate"
      FROM :schema:."UnitSearch" AS units, to_tsquery('pg_catalog.english', '${enhanceQuery(
        query,
      )}') AS query, :schema:."Inventory" AS i, :schema:."Property" AS p
      WHERE units.id = i.id
      AND i."propertyId" = p.id
      AND i.inactive = false
      AND "globalSearchVector" @@ query
      AND inventory_object->>'type' = '${DALTypes.InventoryType.UNIT}'
      ORDER BY rank DESC`;
  } else {
    units = `SELECT inventory_object AS "inventoryObject",
      CASE
        WHEN i."availabilityDate" IS NOT NULL THEN i."availabilityDate"
        ELSE CAST(i."stateStartDate" AS TIMESTAMP)
      END AS "nextStateExpectedDate",
      p."settings"->'integration'->'import'->>'inventoryAvailabilityDate' as "availabilityDateSource",
      (p.settings->'inventory'->>'hideStateFlag')::bool as "hideStateFlag",
      i."state" as "state",
      i."stateStartDate" as "stateStartDate",
      "fullQualifiedName" FROM :schema:."UnitSearch" AS units
     INNER JOIN :schema:."Inventory" AS i ON units.id = i.id
     INNER JOIN :schema:."Property" AS p ON i."propertyId" = p.id
     WHERE inventory_object->>'type' = '${DALTypes.InventoryType.UNIT}'`;
  }
  units += ` LIMIT ${SEARCH_LIMIT_RESULTS};`;

  const results = await knex.raw(units, { schema });

  return (results && results.rows.map(item => ({ ...item, rank: item.rank }))) || [];
};

export const searchParties = async (schema, query, filters = {}) => {
  const { hideClosedParties, hideArchivedParties, searchArchived, addPhoneSearch = false } = filters;
  const wordsTomatch = enhanceExactOrPartialQuery(query, false, true);
  const queryStatement = createQueryStatement(addPhoneSearch, query, wordsTomatch);
  const searchValues = searchRankedValues();

  let statement = `SELECT "partyObject", "propertyDisplayName", "inventoryId", "vacateDate",
  (rankExact * ${searchValues.exactValue}) + ${addPhoneSearch ? `(phoneRankExact * ${searchValues.exactValue}) + ` : ''}
  ${wordsTomatch
    .map((word, index) => ` ${addPhoneSearch ? `(phoneRankWord${index} * ${searchValues.wordRank}) + ` : ''}(rankWord${index} * ${searchValues.wordRank}) +`)
    .join(' ')}
   (rankPartial * ${searchValues.partialValue}) + ${addPhoneSearch ? `(phoneRankPartial * ${searchValues.partialValue}) + ` : ''}
   ${addPhoneSearch ? 'phoneRank + ' : ''} rank as rank
  FROM ( SELECT ps."partyObject",
           property."displayName" AS "propertyDisplayName",
           alwf."leaseData"->>'inventoryId' AS "inventoryId",
           alwf."metadata"->>'vacateDate' as "vacateDate",
           ${queryStatement}
         :schema:."PartySearch" ps
    INNER JOIN :schema:."Party" p ON p."id" = ps."partyId" AND (p."metadata" ->> 'V1RenewalState' IS NULL OR p."metadata" ->> 'V1RenewalState' <> '${
      DALTypes.V1RenewalState.UNUSED
    }') 
    INNER JOIN :schema:."Property" property ON p."assignedPropertyId" = property.id
    LEFT JOIN :schema:."ActiveLeaseWorkflowData" alwf ON
    (CASE WHEN (p."workflowName" = '${DALTypes.WorkflowName.ACTIVE_LEASE}') THEN p.id
          ELSE p."seedPartyId"
          END
    ) = alwf."partyId"`;

  const addGroupClouse = !!addPhoneSearch;
  statement = `${statement} WHERE ${addGroupClouse ? '(' : ''} ps."searchVector"::tsvector @@ query`;

  if (addPhoneSearch) {
    statement = `${statement} or ps."phoneSearchVector"::tsvector @@ query`;
  }
  statement = `${statement}  ${addGroupClouse ? ')' : ''}`;

  if (!searchArchived) {
    if (hideClosedParties) {
      statement = `${statement} AND p."workflowState" <> '${DALTypes.WorkflowState.CLOSED}'`;
    }

    if (hideArchivedParties) {
      statement = `${statement} AND p."workflowState" <> '${DALTypes.WorkflowState.ARCHIVED}'`;
    }
  }

  statement = `${statement}
    ) as partyQuery order by rank DESC, "partyObject"->'createdAt' DESC, "partyObject"->'partyMembersFullNames' ASC LIMIT ${SEARCH_LIMIT_RESULTS};`;

  const results = await knex.raw(statement, { schema });

  return await mapSeries(results.rows, async item => {
    const ctx = { tenantId: schema };
    const fullInventoryName = item?.inventoryId && (await getFullInventoryName(ctx, item.inventoryId));

    const inventory = fullInventoryName && {
      name: fullInventoryName.inventoryName,
      property: { name: fullInventoryName.propertyName },
      building: { name: fullInventoryName.buildingName },
    };

    return {
      ...item.partyObject,
      propertyDisplayName: item.propertyDisplayName,
      inventory,
      rank: item.rank,
      vacateDate: item.vacateDate,
    };
  });
};

export const removePartyFromSearch = async (ctx, partyId) => {
  await initQuery(ctx).from('PartySearch').where({ partyId }).del();
};

export const searchPersons = async (schema, query, filters = {}) => {
  const { onlyOrphans, excludedPersonId, includeSpam = false, addPhoneSearch = false } = filters;
  const wordsTomatch = enhanceExactOrPartialQuery(query, false, true);
  const queryStatement = createQueryStatement(addPhoneSearch, query, wordsTomatch);
  const searchValues = searchRankedValues();

  let statement = `SELECT "personObject", 
  (rankExact * ${searchValues.exactValue}) + ${addPhoneSearch ? `(phoneRankExact * ${searchValues.exactValue}) + ` : ''}
  ${wordsTomatch
    .map((word, index) => `${addPhoneSearch ? `(phoneRankWord${index} * ${searchValues.wordRank}) + ` : ''} (rankWord${index} * ${searchValues.wordRank}) +`)
    .join(' ')}
   (rankPartial * ${searchValues.partialValue}) + ${addPhoneSearch ? `(phoneRankPartial * ${searchValues.partialValue}) + ` : ''}
   ${addPhoneSearch ? 'phoneRank + ' : ''} rank as rank
  FROM (SELECT distinct ps."personObject",
          ${queryStatement}
         :schema:."PersonSearch" ps
    INNER JOIN :schema:."PartyMember" pm ON pm."personId" = ps."personId"
    INNER JOIN :schema:."Party" p ON p."id" = pm."partyId"
    WHERE ps."searchVector"::tsvector @@ query`;

  if (addPhoneSearch) {
    statement = `${statement} or ps."phoneSearchVector"::tsvector @@ query`;
  }

  if (!includeSpam) {
    statement = `${statement} AND ( p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'MARKED_AS_SPAM')`;
  }

  if (onlyOrphans) {
    statement = `${statement} AND pm."endDate" IS NOT NULL`;
  }

  if (excludedPersonId) {
    statement = `${statement} AND ps."personId" <> :personId`;
  }

  statement = `${statement}
    ) as personQuery ORDER BY rank DESC, "personObject"->'fullName' ASC LIMIT ${SEARCH_LIMIT_RESULTS};`;

  const results = await knex.raw(statement, {
    schema,
    personId: excludedPersonId || '',
  });
  return (
    (results &&
      results.rows.map(item => ({
        ...item.personObject,
        rank: item.rank,
      }))) ||
    []
  );
};

export const getUnitFullQualifiedNamesByQuoteIds = async (tenantId, quoteIds) => {
  try {
    if (quoteIds.length === 0) return [];

    const query = `
      WITH inventory_mapping AS (
        SELECT array_agg("inventoryId")::varchar[] AS inventory_ids FROM db_namespace."Quote"
        WHERE id IN (${buildInClause(quoteIds)})
      )
      SELECT DISTINCT q.id AS "quoteId", f.c_inventoryid AS "inventoryId", f.c_fullqualifiedname AS "fullQualifiedName"
      FROM inventory_mapping i
      INNER JOIN db_namespace.getinventoryfullqualifiedname(i.inventory_ids) f ON true
      INNER JOIN db_namespace."Quote" q ON q."inventoryId" = f.c_inventoryid;
    `;
    const { rows } = await rawStatement({ tenantId }, query, [quoteIds]);
    return rows;
  } catch (error) {
    logger.error({ tenantId, error }, 'failed to fetch full qualified names for inventory');
    throw error;
  }
};

export const removePersonFromSearch = async (ctx, personId) => {
  await initQuery(ctx).from('PersonSearch').where({ personId }).del();
};

export const prepareDataForSearch = data => {
  if (!data || isEmailAddress(data) || isPhoneNo(data)) {
    return { firstName: '', lastName: '' };
  }

  const workingName = data.split(',')[0];
  const processedName = Diacritics.replaceDiacritics(workingName)
    .replace(/[^a-zA-Z0-9\@\.\+\'\- ]/g, '') //eslint-disable-line
    .replace(/\s+/g, ' ') // replaces multiple whitespaces with one space
    .trim()
    .split(' ');

  const firstName = processedName.length && processedName[0];
  const lastName = processedName.length > 1 ? processedName[processedName.length - 1] : '';

  return { firstName, lastName };
};

const getEmailMatches = async (schema, emails, personId) => {
  const personIdClause = personId ? 'AND "personId" != :personId' : '';

  const emailMatches = `
    SELECT "personId", "personObject", 1 AS rank, '${DALTypes.PersonMatchType.STRONG}' AS type, true as "exactEmailMatch"
      FROM (SELECT "personId", "personObject", jsonb_array_elements("personObject"->'contactInfo') as "contactInfo"
            FROM :schema:."PersonSearch"
            WHERE "personObject"->'contactInfo' <> 'null') AS "emailResults"
    WHERE lower("emailResults"."contactInfo"->>'value') = ANY( :emails) AND "personObject"->>'personType' <> '${DALTypes.AssetType.EMPLOYEE}'
    ${personIdClause}`;

  return await knex.raw(emailMatches, {
    schema,
    emails,
    personId,
  });
};

export const getPersonMatches = async (schema, query) => {
  // The search data is expected in the form of a json object
  // {
  //   name: 'Mircea Pirv',
  //   personId: uuid,
  //   dismissExistingMatches: true,
  //   phones: {
  //     existingPhoneNumbers: [ '18008007777', '18008006666', '16197384381' ],
  //     newPhoneNumbers: ['16197384381'] },
  //   emails: ['mircea@reva.tech', 'mircea@craftingsoftware.com']
  // }

  const emails = query.emails ? query.emails.map(e => e.toLowerCase()) : [];
  let existingPhoneNumbers =
    query.phones && query.phones.existingPhoneNumbers ? query.phones.existingPhoneNumbers.map(item => formatPhoneNumberForDb(item)) : [];
  const newPhoneNumbers = query.phones && query.phones.newPhoneNumbers ? query.phones.newPhoneNumbers.map(item => formatPhoneNumberForDb(item)) : [];
  const { firstName, lastName } = prepareDataForSearch(query.name);
  const fullName = `${firstName} ${lastName}`.toLowerCase();
  const personId = query.personId || '';
  // const dismissExistingMatches = query.dismissExistingMatches || ''; // to be used for weak matches

  if (!personId) {
    // this the case in which the form is in new person mode - and we only have new numbers - we consider them as existing ones.
    existingPhoneNumbers = newPhoneNumbers;
  }

  const personIdClause = personId ? 'WHERE initialResults."personId" != :personId' : '';

  const strongMatchesClause = personId
    ? `AND "personId" NOT IN (
      SELECT DISTINCT "personId" FROM :schema:."ContactInfo" ci
         WHERE ci."personId" IN (
         SELECT DISTINCT UNNEST(ARRAY[ps."firstPersonId", ps."secondPersonId"])
          FROM :schema:."PersonStrongMatches" ps
          WHERE ("firstPersonId" = :personId or "secondPersonId" = :personId)
          AND status = '${DALTypes.StrongMatchStatus.DISMISSED}'
          AND NOT EXISTS (SELECT TRUE FROM :schema:."PersonStrongMatches" pm
              WHERE ps.id <> pm.id
              AND (ps."firstPersonId" = pm."firstPersonId" OR ps."firstPersonId" = pm."secondPersonId")
              AND (ps."secondPersonId" = pm."firstPersonId" OR ps."secondPersonId" = pm."secondPersonId")
              AND pm.status = '${DALTypes.StrongMatchStatus.NONE}'))
          AND ci."personId" NOT IN (SELECT DISTINCT "personId" FROM :schema:."ContactInfo" c WHERE ARRAY[c.value::text] <@ :newPhoneNumbers))`
    : '';

  const weakMatchesQuery = `
    SELECT id AS "personId", person AS "personObject", rank, '${DALTypes.PersonMatchType.WEAK}' AS type
    FROM :schema:.getWeakMatches( :firstName, :lastName)
  `;

  const strongMatchesQuery = `
    SELECT "personId", "personObject", (CASE WHEN (LOWER("personObject"->>'fullName')=:fullName) THEN 15 else 5 end) AS rank, '${DALTypes.PersonMatchType.STRONG}' AS type
    FROM (SELECT "personId", "personObject", jsonb_array_elements("personObject"->'contactInfo') as "contactInfo"
      FROM :schema:."PersonSearch"
      WHERE "personObject"->'contactInfo' <> 'null'
        AND COALESCE("personObject"->>'mergedWith', '') = '') AS "phoneResults"
    WHERE "phoneResults"."contactInfo"->>'value' = ANY ( :existingPhoneNumbers) AND "personObject"->>'personType' <> '${DALTypes.AssetType.EMPLOYEE}'
      ${strongMatchesClause}
  `;

  const statement = `
    SELECT results."personObject", results.rank, results.type FROM (
      SELECT DISTINCT ON (initialResults."personId") initialResults."personObject", initialResults.rank, initialResults.type
      FROM (
        ${weakMatchesQuery}
        UNION ALL
        ${strongMatchesQuery}
      ) AS initialResults
      ${personIdClause}
      ORDER BY initialResults."personId", rank DESC) AS results
    ORDER BY results.rank DESC
    LIMIT 20`;

  const emailMatches = await getEmailMatches(schema, emails, personId);

  if (emailMatches.rows.length > 0) {
    return emailMatches.rows;
  }

  const results = await knex.raw(statement, {
    schema,
    existingPhoneNumbers,
    newPhoneNumbers,
    emails,
    personId,
    firstName,
    lastName,
    fullName,
  });

  return results.rows || [];
};

export const getInventoryObject = async (ctx, inventoryId) => {
  const query = `
    SELECT
      us."inventory_object" || jsonb_build_object(
        'marketRent', rms."marketRent",
        'priceAvailabilityDate', rms."priceAvailabilityDate",
        'lowestMonthlyRent', rms."lowestMonthlyRent",
        'renewalMarketRent', rms."renewalMarketRent",
        'renewalLowestMonthlyRent', rms."renewalLowestMonthlyRent",
        'minRentLeaseLength', rms."minRentLeaseLength",
        'renewalMinRentLeaseLength', rms."renewalMinRentLeaseLength",
        'renewalDate', rms."renewalDate"
      ) AS "inventoryObject"
    FROM db_namespace."UnitSearch" AS us
    LEFT JOIN
    (
      SELECT
        rms."inventoryId",
        MAX(CASE WHEN "renewalDate" IS NULL THEN "standardRent" ELSE NULL END) AS "marketRent",
        MAX(CASE WHEN "renewalDate" IS NULL THEN "minRent" ELSE NULL END) AS "lowestMonthlyRent",
        MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "standardRent" ELSE NULL END) AS "renewalMarketRent",
        MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "minRent" ELSE NULL END) AS "renewalLowestMonthlyRent",
        MAX(CASE WHEN "renewalDate" IS NULL THEN "minRentLeaseLength" ELSE NULL END) AS "minRentLeaseLength",
        MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "minRentLeaseLength" ELSE NULL END) AS "renewalMinRentLeaseLength",
        MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "renewalDate" ELSE NULL END) AS "renewalDate",
        MAX(CASE WHEN "renewalDate" IS NULL THEN "availDate" ELSE NULL END) AS "priceAvailabilityDate"
      FROM db_namespace."RmsPricing" rms
      WHERE rms."inventoryId" = :inventoryId
      GROUP BY rms."inventoryId"
    ) rms ON rms."inventoryId" = us.id
    WHERE us.id = :inventoryId
    limit 1;
  `;
  const { rows } = await rawStatement(ctx, query, [{ inventoryId }]);
  const { inventoryObject } = (rows && rows[0]) || {};
  return inventoryObject;
};

export const searchCompanies = async (ctx, query) => {
  const escapedQuery = query.replaceAll("'", "''").toLowerCase();
  const companySearchQuery = `
    SELECT id, "displayName" 
      FROM db_namespace."Company" 
      WHERE lower("displayName") LIKE '${escapedQuery}%'
    ORDER BY "displayName" ASC;`;

  const results = await rawStatement(ctx, companySearchQuery, [{ query }]);

  return results.rows || [];
};
