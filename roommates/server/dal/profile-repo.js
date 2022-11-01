/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import omit from 'lodash/omit';
import omitBy from 'lodash/omitBy';
import { DALTables } from '../../common/enums/dal-tables';
import { getOne, updateOne, updateJSONBField, exists, knex } from '../../../server/database/factory';
import { commonSchema } from '../../../common/helpers/database';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import { buildSelectQuery } from '../helpers/profile-helper';

const COMMON_SCHEMA = commonSchema;

export const validateIfExists = userId => exists(COMMON_SCHEMA, DALTables.Tables.USERS, userId);

const removeUndefinedDataFromObj = obj => omitBy(obj, value => value == null || value === '' || value.length === 0);

export const saveProfile = async (userId, profile) => {
  await execConcurrent(
    Object.keys(removeUndefinedDataFromObj(profile)).map(key =>
      updateJSONBField({
        schema: COMMON_SCHEMA,
        table: DALTables.Tables.USERS,
        tableId: userId,
        field: DALTables.TableColumns.USERS.ROOMMATE_PROFILE,
        key,
        value: profile[key],
      }),
    ),
  );

  const ctx = { tenantId: COMMON_SCHEMA };
  const commonUser = await getOne(ctx, DALTables.Tables.USERS, userId);
  if (!commonUser.anonymousEmailId) {
    await updateOne(ctx.tenantId, DALTables.Tables.USERS, userId, {
      anonymousEmailId: getUUID(),
    });
  }

  return omit(commonUser, ['password', 'loginAttempts', 'lastLoginAttempt', 'inactive', 'anonymousEmailId', 'created_at', 'updated_at']);
};

export const getProfile = async userId => {
  const fieldsToSelect = buildSelectQuery(DALTables.TableColumns.USERS, {
    isYourProfile: true,
  });

  const query = knex.withSchema(COMMON_SCHEMA).from(DALTables.Tables.USERS).where({ id: userId });

  query.first(knex.raw(fieldsToSelect));

  return await query;
};
