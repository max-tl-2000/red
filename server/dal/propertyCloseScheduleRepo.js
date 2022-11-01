/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertOrUpdate } from '../database/factory';
import { knex } from '../database/knex';
import logger from '../../common/helpers/logger';

export const savePropertyCloseSchedule = (ctx, propertyCloseSchedule) =>
  insertOrUpdate(ctx.tenantId, 'PropertyCloseSchedule', propertyCloseSchedule, { conflictColumns: ['month', 'propertyId', 'year'], outerTrx: ctx.trx });

const loadPropertyCloseScheduleBy = async (ctx, filter) => {
  const query = initQuery(ctx)
    .from('PropertyCloseSchedule')
    .innerJoin('Property', 'PropertyCloseSchedule.propertyId', 'Property.id')
    .select('PropertyCloseSchedule.*', 'Property.postMonth', 'Property.timezone');

  return await (filter ? filter(query) : query);
};

export const getPropertyCloseSchedules = async ctx => await loadPropertyCloseScheduleBy(ctx);

export const getPropertyCloseScheduleByRollForwardDate = async (ctx, propertyId, rollForwardDate) => {
  logger.trace({ ctx, propertyId, rollForwardDate }, 'getPropertyCloseScheduleByRollForwardDate');

  return await loadPropertyCloseScheduleBy(ctx, q => q.where({ propertyId, rollForwardDate }));
};

// Get properties to roll forward post month in a given date range
export const getPropertiesToRollForwardPostMonth = async (ctx, fromDay, toDay) => {
  logger.trace({ ctx, fromDay, toDay }, 'getPropertiesToRollForwardPostMonth');

  return await knex(ctx)
    .withSchema(ctx.tenantId)
    .from('PropertyCloseSchedule')
    .innerJoin('Property', 'PropertyCloseSchedule.propertyId', 'Property.id')
    .select('PropertyCloseSchedule.propertyId', knex.raw('min("rollForwardDate") as "rollForwardDate"'))
    .whereRaw(`"PropertyCloseSchedule"."rollForwardDate" >= '${fromDay.format()}'`)
    .whereRaw(`"PropertyCloseSchedule"."rollForwardDate" <= '${toDay.format()}'`)
    .groupBy('PropertyCloseSchedule.propertyId');
};

export const getPropertiesCloseScheduleToExport = async (ctx, simpleFields, foreignKeys, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `PropertyCloseSchedule.${field}`);

  const foreignKeysToSelect = foreignKeys.reduce((acc, foreignKey) => {
    const a = foreignKey.fields.map(field => `${foreignKey.tableRef}.${field.dbField} as ${field.columnHeader}`);
    return acc.concat(a);
  }, []);

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .from('PropertyCloseSchedule')
    .innerJoin('Property', 'PropertyCloseSchedule.propertyId', 'Property.id')
    .whereIn('Property.id', propertyIdsToExport);
};
