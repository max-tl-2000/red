/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { insertOrUpdate, initQuery } from '../database/factory';

export const saveExternalPhone = async (ctx, externalPhone) =>
  await insertOrUpdate(ctx.tenantId, 'ExternalPhones', externalPhone, { trx: ctx.trx, conflictColumns: ['number'] });

export const getExternalPhones = async ctx =>
  await initQuery(ctx)
    .from('ExternalPhones')
    .leftJoin('Property', 'ExternalPhones.propertyId', 'Property.id')
    .select('ExternalPhones.*', 'Property.displayName as property');

export const getExternalPhonesToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const simpleFieldsToSelect = simpleFields.map(field => `ExternalPhones.${field}`);

  const foreignKeysToSelect = ['Property.name as property'];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .select('teamIds')
    .from('ExternalPhones')
    .leftJoin('Property', 'ExternalPhones.propertyId', 'Property.id')
    .whereIn('propertyId', propertyIdsToExport)
    .orWhere('propertyId', null);
};
