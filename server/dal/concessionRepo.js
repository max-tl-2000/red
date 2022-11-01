/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, initQuery, insertOrUpdate, rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes.js';
import logger from '../../common/helpers/logger';

const jsonUpdatesQueryBuilder = (knexFromFactory, tablename, delta) => {
  const jsonColumnUpdate = (value = '{}') => knexFromFactory.raw(':param::jsonb', { param: value });
  return {
    ...delta,
    matchingCriteria: jsonColumnUpdate(delta.matchingCriteria),
  };
};

export const saveConcession = (ctx, concession) =>
  insertOrUpdate(ctx.tenantId, 'Concession', concession, {
    jsonUpdatesQueryBuilder,
  });

export const getConcessionsByLeaseState = async (ctx, leaseTermIds, inventoryGroupId, leaseState = DALTypes.LeaseState.NEW) => {
  logger.trace({ ctx, leaseTermIds, inventoryGroupId, leaseState }, 'getConcessionsByLeaseState');

  if (leaseTermIds.length === 0) return [];

  const query = `
  SELECT
   lt.id as "leaseTermId",
   json_agg(json_build_object(
   'id',                         c."id",
   'displayName',                c."displayName",
   'name',                       c.name,
   'variableAdjustment',         c."variableAdjustment",
   'relativeAdjustment',         c."relativeAdjustment",
   'absoluteAdjustment',         c."absoluteAdjustment",
   'relativeDefaultAdjustment',  c."relativeDefaultAdjustment",
   'absoluteDefaultAdjustment',  c."absoluteDefaultAdjustment",
   'recurring',                  c."recurring",
   'recurringCount',             c."recurringCount",
   'nonRecurringAppliedAt',      c."nonRecurringAppliedAt",
   'optional',                   c."optional",
   'hideInSelfService',          c."hideInSelfService",
   'excludeFromRentFlag',        c."excludeFromRentFlag",
   'matchingCriteria',           c."matchingCriteria",
   'startDate',                  c."startDate",
   'endDate',                    c."endDate",
   'bakedIntoAppliedFeeFlag',    c."bakedIntoAppliedFeeFlag",
   'adjustmentFloorCeiling',     c."adjustmentFloorCeiling")) as "concessions"
   FROM db_namespace."Concession" c
   INNER JOIN db_namespace."Concession_Fee" cf ON c."id" = cf."concessionId"
   INNER JOIN db_namespace."InventoryGroup" ig ON cf."feeId" = ig."feeId"
   INNER JOIN db_namespace."LeaseName" ln ON c."propertyId" = ln."propertyId"
   INNER JOIN db_namespace."LeaseTerm" lt ON ln."id" = lt."leaseNameId"
   WHERE ig."id" = :inventoryGroupId
   AND lt.id IN (${leaseTermIds.map(id => `'${id}'`).join(',')})
   AND (c."leaseState" = '${leaseState}'
        OR c."leaseState" IS NULL)
   GROUP BY lt.id
  `;

  const { rows } = await rawStatement(ctx, query, [
    {
      inventoryGroupId,
    },
  ]);
  return rows;
};

export const getAllConcessions = async ctx =>
  await initQuery(ctx)
    .from('Concession')
    .innerJoin('Concession_Fee', 'Concession.id', 'Concession_Fee.concessionId')
    .distinct('Concession.id')
    .select(
      'Concession.id',
      'Concession.displayName',
      'Concession.variableAdjustment',
      'Concession.relativeAdjustment',
      'Concession.absoluteAdjustment',
      'Concession.relativeDefaultAdjustment',
      'Concession.absoluteDefaultAdjustment',
      'Concession.recurring',
      'Concession.recurringCount',
      'Concession.nonRecurringAppliedAt',
      'Concession.optional',
      'Concession.hideInSelfService',
      'Concession.excludeFromRentFlag',
      'Concession.matchingCriteria',
      'Concession.startDate',
      'Concession.endDate',
      'Concession_Fee.feeId',
      'Concession.bakedIntoAppliedFeeFlag',
      'Concession.adjustmentFloorCeiling',
    );

export const getAllConcessionsWithLeaseTerms = async ctx =>
  await initQuery(ctx)
    .from('Concession')
    .innerJoin('Concession_Fee', 'Concession.id', 'Concession_Fee.concessionId')
    .innerJoin('LeaseName', 'Concession.propertyId', 'LeaseName.propertyId')
    .innerJoin('LeaseTerm', 'LeaseName.id', 'LeaseTerm.leaseNameId')
    .distinct('Concession.id')
    .select(
      'Concession.id',
      'LeaseTerm.id AS LeaseTermId',
      'Concession.displayName',
      'Concession.variableAdjustment',
      'Concession.relativeAdjustment',
      'Concession.absoluteAdjustment',
      'Concession.relativeDefaultAdjustment',
      'Concession.absoluteDefaultAdjustment',
      'Concession.recurring',
      'Concession.recurringCount',
      'Concession.nonRecurringAppliedAt',
      'Concession.optional',
      'Concession.hideInSelfService',
      'Concession.excludeFromRentFlag',
      'Concession.matchingCriteria',
      'Concession.startDate',
      'Concession.endDate',
      'Concession_Fee.feeId',
      'Concession.bakedIntoAppliedFeeFlag',
    )
    .whereRaw('"Concession"."leaseState" = :leaseStateNew OR "Concession"."leaseState" is NULL;', { leaseStateNew: DALTypes.LeaseState.NEW });

export const getConcessionsByIds = async (ctx, ids) => await initQuery(ctx).from('Concession').whereIn('id', ids);

export const getConcessionsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const { tenantId } = ctx;
  const simpleFieldsToSelect = simpleFields.map(field => `Concession.${field}`);
  const foreignKeysToSelect = ['Property.name as property', 'Property.timezone as timezone'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  const query = initQuery(ctx)
    .select(allFieldsToSelect)
    .select('Concession.matchingCriteria')
    .select(
      knex.raw(
        `ARRAY(select "Fee".name
              from :tenantId:."Concession_Fee"
              inner join :tenantId:."Fee" on "Concession_Fee"."feeId" = "Fee".id
              where "Concession".id = "Concession_Fee"."concessionId"
        ) as "appliedToFees"`,
        {
          tenantId,
        },
      ),
    )
    .from('Concession')
    .innerJoin('Property', 'Concession.propertyId', 'Property.id')
    .whereIn('Property.id', propertyIdsToExport);

  return await query;
};
