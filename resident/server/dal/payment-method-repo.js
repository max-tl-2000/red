/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { COMMON } from '../../../server/common/schemaConstants';
import { rawStatement, insertInto } from '../../../server/database/factory';

const USER_PAYMENT_METHOD_TABLE = 'UserPaymentMethod';

export const getPaymentMethodById = async (ctx, paymentMethodId) => {
  const query = `
    SELECT *
    FROM db_namespace.:paymentMethodTable:
    WHERE id = :paymentMethodId
  `;

  const { rows = [] } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [
    {
      paymentMethodId,
      paymentMethodTable: USER_PAYMENT_METHOD_TABLE,
    },
  ]);

  return rows[0];
};

export const getPaymentMethodsByUserIdAndIntegrationId = async (ctx, commonUserId, integrationId) => {
  const query = `
    SELECT *
    FROM db_namespace.:paymentMethodTable:
    WHERE "userId" = :commonUserId AND "integrationId" = :integrationId
  `;

  const { rows } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [
    {
      commonUserId,
      integrationId,
      paymentMethodTable: USER_PAYMENT_METHOD_TABLE,
    },
  ]);

  return rows;
};

export const upsertPaymentMethod = async (ctx, paymentMethod, { updateOnConflict, conflictColumns } = {}) =>
  await insertInto({ ...ctx, tenantId: COMMON }, USER_PAYMENT_METHOD_TABLE, paymentMethod, { updateOnConflict, conflictColumns });

export const deletePaymentMethodById = async (ctx, paymentMethodId) => {
  const query = `
    DELETE
    FROM db_namespace.:paymentMethodTable:
    WHERE id = :paymentMethodId
  `;

  const { rows } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [
    {
      paymentMethodId,
      paymentMethodTable: USER_PAYMENT_METHOD_TABLE,
    },
  ]);

  return rows;
};

export const changeDefaultPaymentMethodById = async (ctx, paymentMethodId, userId) => {
  const query = `
    WITH updated as (
      UPDATE db_namespace."UserPaymentMethod" paymentMethod
        SET "isDefault" = FALSE
      WHERE "isDefault" = true
        AND "userId" = :userId
        AND "integrationId" = (SELECT "integrationId" FROM db_namespace."UserPaymentMethod" WHERE "id" = :paymentMethodId)
    )
    UPDATE db_namespace."UserPaymentMethod" paymentMethod
    SET "isDefault" = TRUE
    WHERE "id" = :paymentMethodId;
  `;

  const { rows } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [
    {
      paymentMethodId,
      userId,
    },
  ]);

  return rows;
};

export const updatePaymentMethodExpirationMonth = async (ctx, paymentMethodId, expirationMonth) => {
  const query = `
    UPDATE db_namespace."UserPaymentMethod"
    SET "expirationMonth" = :expirationMonth
    WHERE "id" = :paymentMethodId
  `;

  const { rows } = await rawStatement({ ...ctx, tenantId: COMMON }, query, [
    {
      paymentMethodId,
      expirationMonth,
    },
  ]);

  return rows;
};
