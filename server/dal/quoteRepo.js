/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, insertInto, initQuery, rawStatement } from '../database/factory';
import { nonNullishProps } from '../../common/assert';
import { getJsonInventoryAmenitiesQuery, getJsonComplimentsForInventoryQuery } from './inventoryRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { prepareRawQuery } from '../common/schemaConstants';

export const saveQuote = async (ctx, quote) =>
  nonNullishProps(quote, ['inventoryId', 'partyId', 'propertyTimezone']) &&
  (await insertInto(
    ctx.tenantId,
    'Quote',
    { ...quote, modified_by: ctx.authUser && ctx.authUser.id },
    {
      outerTrx: ctx.trx,
    },
  ));

// the following functions were used as query builders
// eslint-disable-next-line
export const getQuotes = ctx => initQuery(ctx).from('Quote');

// eslint-disable-next-line
export const deleteQuoteById = (ctx, id) =>
  initQuery(ctx)
    .from('Quote')
    .where({ id })
    .del();

// eslint-disable-next-line
export const updateQuoteById = (ctx, id, data) =>
  initQuery(ctx)
    .from('Quote')
    .where({ id })
    .update({ ...data, modified_by: ctx.authUser && ctx.authUser.id });

const quoteBaseQuery = `
    SELECT
      q.id,
      q."partyId",
      q."publishDate",
      q."expirationDate",
      q."leaseStartDate",
      q."selections",
      q."created_at",
      q."publishedQuoteData",
      q."propertyTimezone",
      q."createdFromCommId",
      q."leaseState",
      json_build_object(
        'id', i.id,
        'name', u."inventoryName",
        'inventoryGroupId', i."inventoryGroupId",
        'fullQualifiedName', u."fullQualifiedName",
        'state',  i.state,
        'stateStartDate', i."stateStartDate",
        'type', i.type,
        'lowestMonthlyRent', rms."lowestMonthlyRent",
        'marketRent', rms."marketRent",
        'renewalMarketRent', rms."renewalMarketRent",
        'availabilityDate', i."availabilityDate",
        'availabilityDateSource', p.settings->'integration'->'import'->>'inventoryAvailabilityDate',
        'hideStateFlag', p.settings->'inventory'->>'hideStateFlag',
        'expectedMakeReadyDuration', p.settings->'inventory'->>'expectedMakeReadyDuration',
        'building', json_build_object(
          'id', b.id,
          'name', b.name,
          'displayName', b."displayName"
        ),
        'property', json_build_object(
          'id', p.id,
          'name', p.name,
          'displayName', p."displayName",
          'timezone', p."timezone"
        ),
        'layout', json_build_object(
          'id', l.id,
          'numBedrooms', l."numBedrooms",
          'numBathrooms', l."numBathrooms"
        )
      ) as inventory
    FROM :tenantId:."Quote" q
    JOIN :tenantId:."Inventory" i ON i.id = q."inventoryId"
    LEFT JOIN :tenantId:."Layout" l ON i."layoutId" = l.id
    LEFT JOIN :tenantId:."UnitSearch" u ON u.id = q."inventoryId"
    LEFT JOIN
    (
    SELECT
      rms."inventoryId",
      MAX(CASE WHEN "renewalDate" IS NULL THEN "standardRent" ELSE NULL END) AS "marketRent",
      MAX(CASE WHEN "renewalDate" IS NULL THEN "minRent" ELSE NULL END) AS "lowestMonthlyRent",
      MAX(CASE WHEN "renewalDate" IS NOT NULL THEN "standardRent" ELSE NULL END) AS "renewalMarketRent"
    FROM :tenantId:."RmsPricing" rms
    GROUP BY rms."inventoryId"
    ) rms ON rms."inventoryId" = q."inventoryId"
    LEFT JOIN :tenantId:."Building" b ON b.id = i."buildingId"
    JOIN :tenantId:."Property" p ON p.id = i."propertyId"
  `;

// For hot fix, duplicating quoteBaseQuery for now, but the one above should go away
const quoteBaseQueryRawStatement = `
    SELECT
      q.id,
      q."partyId",
      q."publishDate",
      q."expirationDate",
      q."leaseStartDate",
      q."selections",
      q."created_at",
      q."publishedQuoteData",
      q."propertyTimezone",
      q."createdFromCommId",
      q."leaseState",
      json_build_object(
        'id', i.id,
        'name', u."inventoryName",
        'fullQualifiedName', u."fullQualifiedName",
        'state',  i.state,
        'stateStartDate', i."stateStartDate",
        'type', i.type,
        'lowestMonthlyRent', u.inventory_object ->> 'lowestMonthlyRent',
        'marketRent', u.inventory_object ->> 'marketRent',
        'renewalMarketRent', u.inventory_object ->> 'renewalMarketRent',
        'availabilityDate', i."availabilityDate",
        'availabilityDateSource',  p.settings->'integration'->'import'->>'inventoryAvailabilityDate',
        'hideStateFlag', p.settings->'inventory'->>'hideStateFlag',
        'expectedMakeReadyDuration', p.settings->'inventory'->>'expectedMakeReadyDuration',
        'building', json_build_object(
          'id', b.id,
          'name', b.name,
          'displayName', b."displayName"
        ),
        'property', json_build_object(
          'id', p.id,
          'name', p.name,
          'displayName', p."displayName",
          'timezone', p."timezone"
        ),
        'layout', json_build_object(
          'id', l.id,
          'numBedrooms', l."numBedrooms",
          'numBathrooms', l."numBathrooms"
        )
      ) as inventory
    FROM db_namespace."Quote" q
    JOIN db_namespace."Inventory" i ON i.id = q."inventoryId"
    LEFT JOIN db_namespace."Layout" l ON i."layoutId" = l.id
    LEFT JOIN db_namespace."UnitSearch" u ON u.id = q."inventoryId"
    LEFT JOIN db_namespace."Building" b ON b.id = i."buildingId"
    JOIN db_namespace."Property" p ON p.id = i."propertyId"
  `;

export const getQuoteById = async (ctx, quoteId) => {
  const query = `${quoteBaseQuery} WHERE q."id" = :quoteId`;
  const results = await rawStatement(ctx, query, [{ tenantId: ctx.tenantId, quoteId }]);

  return (results && results.rows[0]) || {};
};

export const getQuoteByIdAndHoldInventory = async (ctx, quoteId) => {
  const query = `${quoteBaseQuery} INNER JOIN :tenantId:."Tasks" t ON t."partyId"  = q."partyId"
  AND t."name"  = '${DALTypes.TaskNames.HOLD_INVENTORY}' AND t.metadata->'inventoryName' IS NOT NULL AND q."id" = :quoteId`;
  const results = await rawStatement(ctx, query, [{ tenantId: ctx.tenantId, quoteId }]);

  return (results && results.rows[0]) || {};
};

// eslint-disable-next-line
export const getQuoteByIdQuery = ({ tenantId }, quoteId) =>
  knex.raw(
    `
    SELECT
      q.id,
      q."partyId",
      q."publishDate",
      q."expirationDate",
      q."leaseStartDate",
      q."selections",
      q."created_at",
      q."publishedQuoteData",
      q."propertyTimezone",
      json_build_object(
        'id', i.id,
        'name', u."inventoryName",
        'address', i.address,
        'fullQualifiedName', u."fullQualifiedName",
        'state',  i.state,
        'type', i.type,
        'lowestMonthlyRent', rms."lowestMonthlyRent",
        'marketRent', rms."marketRent",
        'building', json_build_object(
          'id', b.id,
          'name', b.name,
          'displayName', b."displayName",
          'addressId', a.id,
          'addressLine1', a."addressLine1",
          'addressLine2', a."addressLine2",
          'address', json_build_object(
            'addressLine1', a."addressLine1",
            'addressLine2', a."addressLine2",
            'city', a.city,
            'state', a.state,
            'postalCode', a."postalCode"
          )
        ),
        'property', json_build_object(
          'id', p.id,
          'name', p.name,
          'displayName', p."displayName",
          'timezone', p."timezone",
          'settings', p."settings",
          'address', json_build_object(
            'addressLine1', pa."addressLine1",
            'addressLine2', pa."addressLine2",
            'city', pa.city,
            'state', pa.state,
            'postalCode', pa."postalCode"
          )
        ),
        'layout', json_build_object(
          'id', l.id,
          'numBedrooms', l."numBedrooms",
          'numBathrooms', l."numBathrooms",
          'surfaceArea', l."surfaceArea",
          'displayName', l."displayName"
        ),
        'amenities', (${getJsonInventoryAmenitiesQuery(
          { tenantId },
          {
            inventoryIdColumn: 'i.id',
            buildingIdColumn: 'i.buildingId',
            inventoryGroupIdColumn: 'i.inventoryGroupId',
            propertyIdColumn: 'i.propertyId',
            layoutIdColumn: 'i.layoutId',
          },
        )}),
        'complimentaryItems', (${getJsonComplimentsForInventoryQuery(
          { tenantId },
          { inventoryIdColumn: 'i.id', inventoryGroupIdColumn: 'i.inventoryGroupId' },
        )})
      ) as inventory
    FROM :tenantId:."Quote" q
    JOIN :tenantId:."Inventory" i ON i.id = q."inventoryId"
    LEFT JOIN :tenantId:."Layout" l ON i."layoutId" = l.id
    LEFT JOIN :tenantId:."UnitSearch" u ON u.id = q."inventoryId"
    LEFT JOIN
    (
    SELECT
      rms."inventoryId",
      MAX(CASE WHEN "renewalDate" IS NULL THEN "standardRent" ELSE NULL END) AS "marketRent",
      MAX(CASE WHEN "renewalDate" IS NULL THEN "minRent" ELSE NULL END) AS "lowestMonthlyRent"
    FROM :tenantId:."RmsPricing" rms
    GROUP BY rms."inventoryId"
    ) rms ON rms."inventoryId" = q."inventoryId"
    LEFT JOIN :tenantId:."Building" b ON b.id = i."buildingId"
    LEFT JOIN :tenantId:."Address" a ON a.id = b."addressId"
    JOIN :tenantId:."Property" p ON p.id = i."propertyId"
    LEFT JOIN :tenantId:."Address" pa ON pa.id = p."addressId"
  WHERE q."id" = :quoteId LIMIT 1`,
    { tenantId, quoteId },
  );

export const getPublishedQuotesByPartyId = async (ctx, partyId) => await initQuery(ctx).from('Quote').where({ partyId }).whereNotNull('publishDate');

export const getPublishedQuotesWithPropertyDataByPartyId = async (ctx, partyId) => {
  const query = `SELECT
      quote.*,
      property.id AS "propertyId",
      property.name as "propertyName"
    FROM db_namespace."Quote" quote
    LEFT JOIN db_namespace."Inventory" inventory ON inventory.id = quote."inventoryId"
    LEFT JOIN db_namespace."Property" property ON property.id = inventory."propertyId"
    WHERE quote."partyId" = :partyId
    AND quote."publishDate" IS NOT NULL`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows;
};

export const getQuoteWithPropertyDataByPartyId = async (ctx, quoteId) => {
  const query = `SELECT
      quote.*,
      property.id AS "propertyId",
      property.name as "propertyName"
    FROM db_namespace."Quote" quote
    LEFT JOIN db_namespace."Inventory" inventory ON inventory.id = quote."inventoryId"
    LEFT JOIN db_namespace."Property" property ON property.id = inventory."propertyId"
    WHERE quote.id = :quoteId`;

  const { rows } = await rawStatement(ctx, query, [{ quoteId }]);

  return rows[0] || null;
};

export const getPropertyApplicationSettingsFromPublishedQuotesByPartyId = async (ctx, partyId) => {
  const query = `SELECT
      DISTINCT property.id AS "propertyId",
      property.settings->'applicationSettings' AS "applicationSettings"
    FROM db_namespace."Quote" quote
    LEFT JOIN db_namespace."Inventory" inventory ON inventory.id = quote."inventoryId"
    LEFT JOIN db_namespace."Property" property ON property.id = inventory."propertyId"
    WHERE quote."partyId" = :partyId
    AND quote."publishDate" IS NOT NULL`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);

  return rows;
};

export const getPropertyByQuoteId = async (ctx, quoteId) => {
  const query = `SELECT
      property.id
    FROM db_namespace."Quote" quote
    INNER JOIN db_namespace."Inventory" inventory ON inventory.id = quote."inventoryId"
    INNER JOIN db_namespace."Property" property ON property.id = inventory."propertyId"
    WHERE quote.id = :quoteId`;

  const { rows } = await rawStatement(ctx, query, [{ quoteId }]);

  return rows.length ? rows[0] : null;
};

export const getPublishedQuotesLengthByPartyId = async (ctx, partyId) =>
  parseInt((await initQuery(ctx).from('Quote').where({ partyId }).count('publishDate'))[0].count, 10);

export const loadQuotesByPartyId = async (ctx, partyId) => {
  const query = `${quoteBaseQuery} WHERE q."partyId" = :partyId`;
  const results = await rawStatement(ctx, query, [{ tenantId: ctx.tenantId, partyId }]);
  return (results && results.rows) || [];
};

export const loadPublishedQuotesDataByPartyId = async (ctx, partyId) => {
  const query = `
    SELECT "publishedQuoteData" FROM db_namespace."Quote"
      WHERE "partyId" = :partyId AND "publishDate" IS NOT NULL`;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

export const getQuotesByPartyId = async (ctx, partyId) => await initQuery(ctx).from('Quote').where({ partyId });

export const getLastPublishedQuote = async (tenantId, partyId) => {
  const query = `${quoteBaseQuery} WHERE q."partyId" = :partyId ORDER BY q."publishDate" DESC LIMIT 1`;
  const results = await knex.raw(query, { tenantId, partyId });
  return (results && results.rows[0]) || {};
};

export const getQuotesByInventoryIdForActiveParties = async (ctx, inventoryId) => {
  const query = `${quoteBaseQueryRawStatement}
  JOIN db_namespace."Party" pa ON pa.id = q."partyId"
  WHERE q."inventoryId" = :inventoryId
  AND q."expirationDate" > NOW()
  AND (
    (pa."leaseType" = :traditional AND pa.state NOT IN (:resident, :futureResident))
    OR (pa."leaseType" = :corporate AND pa.state != :resident)
  )
  AND pa."workflowState" = :state AND pa."workflowName" = :workflowName AND pa."endDate" IS NULL`;
  const results = await rawStatement(ctx, query, [
    {
      inventoryId,
      traditional: DALTypes.PartyTypes.TRADITIONAL,
      corporate: DALTypes.PartyTypes.CORPORATE,
      resident: DALTypes.PartyStateType.RESIDENT,
      futureResident: DALTypes.PartyStateType.FUTURERESIDENT,
      state: DALTypes.WorkflowState.ACTIVE,
      workflowName: DALTypes.WorkflowName.NEW_LEASE,
    },
  ]);

  return (results && results.rows) || [];
};

export const isRenewalQuoteOrCorporateLease = async (ctx, quoteId) => {
  const result = await knex.raw(
    prepareRawQuery(
      `SELECT EXISTS (SELECT q.id FROM db_namespace."Quote" q
           INNER JOIN db_namespace."Party" p ON q."partyId" = p.id
       WHERE q.id = :quoteId AND (p."workflowName" = :renewalWorkflow OR p."leaseType" = :corporateType))::int`,
      ctx.tenantId,
    ),
    {
      quoteId,
      renewalWorkflow: DALTypes.WorkflowName.RENEWAL,
      corporateType: DALTypes.PartyTypes.CORPORATE,
    },
  );
  return (result.rows && result.rows[0].exists) || false;
};

export const isRenewalQuote = async (ctx, quoteId) => {
  const result = await knex.raw(
    prepareRawQuery(
      `SELECT EXISTS (SELECT q.id FROM db_namespace."Quote" q
           INNER JOIN db_namespace."Party" p ON q."partyId" = p.id
       WHERE q.id = :quoteId AND p."workflowName" = :renewalWorkflow)::int`,
      ctx.tenantId,
    ),
    {
      quoteId,
      renewalWorkflow: DALTypes.WorkflowName.RENEWAL,
    },
  );
  return (result.rows && result.rows[0].exists) || false;
};
