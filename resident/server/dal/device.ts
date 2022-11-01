/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { updateOne, rawStatement, exists } from '../../../server/database/factory';
import loggerInstance from '../../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'Resident - Device DAL' });

const DEVICES_TABLE = 'Devices';

type Device = {
  id: string;
  userId: string;
  pushToken: string;
  details: { [key: string]: any };
};

export const insertDevice = async (ctx: any, { userId, pushToken, details, id = newId() }: Partial<Device>) => {
  const statement = `INSERT INTO db_namespace."Devices" (id, "userId", "pushToken", details)
    VALUES (:id, :userId, :pushToken, (:details)::jsonb)
    RETURNING *;
  `;

  const {
    rows: [record],
  } = await rawStatement(ctx, statement, [{ id, userId, pushToken, details }]);

  return record;
};

export const updateDevice = async (ctx: any, id: string, delta: Partial<Device>) => {
  const deviceRecordExists = await exists(ctx, DEVICES_TABLE, id);

  if (deviceRecordExists) return await updateOne(ctx, DEVICES_TABLE, id, delta);

  logger.warn({ ctx, id, delta }, 'device record with client provided id does not exist, inserting a new one');
  return await insertDevice(ctx, { id, ...delta });
};

export const getDevicesByUserIds = async (ctx: any, userIds: string[]) => {
  const query = 'SELECT * from db_namespace."Devices" WHERE "userId" = ANY(:userIds);';

  const { rows } = await rawStatement(ctx, query, [{ userIds }]);
  return rows;
};
