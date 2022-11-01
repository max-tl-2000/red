/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import { prepareRawQuery } from '../../../server/common/schemaConstants';

import logger from '../../../common/helpers/logger';

const BOOTSTRAP_PATH = '../database/schema/rentapp.sql';

export async function addRentappTablesToTenant(conn, tenant) {
  const { id: tenantId, name: tenantName } = tenant;

  logger.time(`Add RentappTables to tenantId: ${tenantId}`);

  logger.info(`Adding rentapp tables for tenant: ${tenantName} (${tenantId})`);

  const readFile = Promise.promisify(fs.readFile);

  let data = await readFile(path.join(__dirname, BOOTSTRAP_PATH), 'utf8');
  logger.time({ tenantId }, 'rentapp-sync-schema');
  data = prepareRawQuery(data, tenantId);

  await conn.raw(data);
  logger.timeEnd({ tenantId }, 'rentapp-sync-schema');

  logger.timeEnd(`Add RentappTables to tenantId: ${tenantId}`);
}
