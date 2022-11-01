/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../common/helpers/logger';
import { rawStatement } from '../database/factory';

export const getAppSettings = async ctx => {
  logger.debug({ ctx }, 'getAppSettings');
  const query = 'SELECT * FROM db_namespace."AppSettings" ORDER BY CATEGORY, KEY ASC';

  const { rows } = await rawStatement(ctx, query);

  return rows;
};

export const saveAppSetting = async (ctx, setting) => {
  logger.trace({ ctx, setting }, 'saveAppSetting');
  const command = `
      INSERT INTO db_namespace."AppSettings"
      (id, key, value, category, datatype, description)
      VALUES("public".gen_random_uuid(), :key, :value, :category, :datatype, :description)
      RETURNING *
      `;

  const { rows } = await rawStatement(ctx, command, [setting]);

  return rows ? rows[0] : {};
};

export const getAppSettingByName = async (ctx, name) => {
  logger.debug({ ctx, name }, 'getAppSettingByName');
  const query = `
      SELECT * FROM db_namespace."AppSettings"
      WHERE key = :name
  `;

  const { rows } = await rawStatement(ctx, query, [{ name }]);

  return rows && rows[0];
};

export const getAppSettingValue = async (ctx, name) => {
  logger.debug({ ctx, name }, 'getAppSettingValue');
  const query = `
      SELECT value FROM db_namespace."AppSettings"
      WHERE key = :name
  `;

  const { rows } = await rawStatement(ctx, query, [{ name }]);

  return rows && rows[0] && rows[0].value;
};

export const updateAppSettingValue = async (ctx, key, newValue) => {
  logger.debug({ ctx, key, newValue }, 'updateAppSettingValue');
  const query = `
        UPDATE db_namespace."AppSettings"
        SET value = :value
        WHERE key = :key
    `;

  const { rows } = await rawStatement(ctx, query, [{ value: newValue, key }]);

  return rows && rows[0] && rows[0].value;
};

export const updateMultipleAppSettings = async (ctx, keyValuePairs) => {
  logger.debug({ ctx, keyValuePairs }, 'updateMultipleAppSettings');

  const newValuesSubselect = keyValuePairs.map(kvp => `SELECT '${kvp.key}' AS "key", '${kvp.value}' as "value" `).join('UNION ALL ');

  const dml = `WITH newValues AS (${newValuesSubselect})
               UPDATE db_namespace."AppSettings" AS upd
               SET "value" = n."value"
               FROM newValues AS n
               WHERE upd."key" = n."key"`;

  const { rows } = await rawStatement(ctx, dml);

  return rows;
};

export const getMultipleAppSettingsByKey = async (ctx, settingNames) => {
  logger.debug({ ctx, settingNames }, 'getMultipleAppSettingsByKey');

  const query = `
    SELECT * FROM db_namespace."AppSettings"
    WHERE ARRAY[key::varchar(36)] <@ :settingNames
  `;

  const { rows } = await rawStatement(ctx, query, [{ settingNames }]);

  return rows;
};
