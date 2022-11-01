/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../../../server/database/factory';

export const getPropertyIdsByPersonIdAndAppId = async (ctx, personId, appId) => {
  if (!appId || !personId) return [];

  const query = `
    SELECT ARRAY_AGG(DISTINCT(property.id)) "propertyIds"
    FROM db_namespace."PartyMember" pm
    INNER JOIN db_namespace."Party" p ON (pm."partyId" = p.id)
    INNER JOIN db_namespace."Property" property on (p."assignedPropertyId" = property.id)
    WHERE
      pm."vacateDate" is null AND
      pm."personId" = :personId AND
      property.settings -> 'rxp' -> 'app' ->> 'id' = :appId
  `;
  const { rows } = await rawStatement(ctx, query, [{ appId, personId }]);
  return rows[0]?.propertyIds || [];
};

export const getPropertySettingsByPropertyId = async (ctx, propertyId) => {
  const { rows } = await rawStatement(
    ctx,
    `
      SELECT p.settings FROM db_namespace."Property" p WHERE p.id = :propertyId
      `,
    [
      {
        propertyId,
      },
    ],
  );

  return !rows.length ? {} : rows[0];
};

export const getAptexxSettingsByPropertyId = async (ctx, propertyId) => {
  const { rows } = await rawStatement(
    ctx,
    'SELECT p."paymentProvider" -> \'aptexx\' "aptexxSettings" FROM db_namespace."Property" p WHERE p.id = :propertyId',
    [{ propertyId }],
  );

  return !rows.length ? {} : rows[0].aptexxSettings;
};

export const validatePropertyBelongsToTenant = async (ctx, propertyId) => {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM db_namespace."Property" where id = :propertyId
    )
  `;
  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows[0]?.exists;
};

export const getPaymentProviderSettingsByPropertyId = async (ctx, propertyId) => {
  const query = `
    SELECT "paymentProvider"
    FROM db_namespace."Property"
    WHERE id = :propertyId
  `;
  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows[0]?.paymentProvider || {};
};

export const getPropertyTimezone = async (ctx, propertyId) => {
  const query = 'SELECT timezone FROM db_namespace."Property" WHERE id = :propertyId';
  const { rows } = await rawStatement(ctx, query, [{ propertyId }]);
  return rows[0]?.timezone;
};

export const insertOrUpdateLastAccessedProperty = async (ctx, { commonUserId, propertyId }) => {
  const query = `
    INSERT INTO common."AccessedProperties" (id, "tenantId", "propertyId", "commonUserId", "lastAccessed")
    VALUES ( "public".gen_random_uuid(), :tenantId, :propertyId, :commonUserId, now() )
    ON CONFLICT ("tenantId", "propertyId", "commonUserId")
    DO UPDATE SET "lastAccessed" = now()
    RETURNING *;`;

  const { rows } = await rawStatement(ctx, query, [
    {
      tenantId: ctx.tenantId,
      propertyId,
      commonUserId,
    },
  ]);

  return rows?.[0];
};
