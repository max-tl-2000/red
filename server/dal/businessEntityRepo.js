/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, insertOrUpdate, runInTransaction } from '../database/factory';
import { ServiceError } from '../common/errors';
import logger from '../../common/helpers/logger';

export const saveBusinessEntity = async (ctx, businessEntity) => {
  try {
    return await runInTransaction(async trx => await insertOrUpdate(ctx.tenantId, 'BusinessEntity', businessEntity, { trx }));
  } catch (error) {
    logger.error({ error }, 'Error saving business entity');
    throw new ServiceError('ERROR_SAVING_BUSINESS_ENTITY');
  }
};

export const getBusinessEntity = async ctx => await initQuery(ctx).from('BusinessEntity');

export const getBusinessEntitiesToExport = async (ctx, simpleFields, foreignKeys) => {
  const simpleFieldsToSelect = simpleFields.map(field => `BusinessEntity.${field}`);

  const foreignKeysToSelect = foreignKeys.reduce((acc, foreignKey) => {
    const a = foreignKey.fields.map(field => `${foreignKey.tableRef}.${field.dbField} as ${field.columnHeader}`);
    return acc.concat(a);
  }, []);

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx).select(allFieldsToSelect).from('BusinessEntity').innerJoin('Address', 'BusinessEntity.addressId', 'Address.id');
};
