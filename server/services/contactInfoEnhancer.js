/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { prepareRawQuery, admin } from '../common/schemaConstants';
import { knex, closePool } from '../database/factory';
import { getTenantByName } from '../dal/tenantsRepo';
import { updatePerson, getPersonById } from '../dal/personRepo';
import { enhanceContactInfoWithSmsInfo } from './telephony/twilio';

export const enhanceContactInfos = async ctx => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
        SELECT * FROM db_namespace."ContactInfo" WHERE metadata='{}' AND type='phone' ORDER BY created_at DESC;
      `,
      ctx.tenantId,
    ),
  );

  await mapSeries(rows, async ci => {
    const dbPerson = await getPersonById(ctx, ci.personId);

    if (dbPerson.contactInfo) {
      dbPerson.contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, dbPerson.contactInfo.all);
    }

    await updatePerson(ctx, ci.personId, dbPerson);
  });
};

const getTenantContext = async tenantName => {
  const ctx = { tenantId: admin.id };
  const tenant = await getTenantByName(ctx, tenantName);

  if (!tenant) {
    console.error('Tenant not found');
    return {};
  }
  return { tenantId: tenant.id };
};

async function main() {
  const tenantName = process.argv[2];

  if (!tenantName) {
    console.error('Usage:');
    console.error("node_modules/.bin/babel-node --extensions '.js,.ts' ./scripts/updateContactInfos.sh maximus");
  }

  const tenantCtx = await getTenantContext(tenantName);

  try {
    await enhanceContactInfos(tenantCtx);
  } catch (error) {
    console.error('An error occured: ', error);
  }
}

if (require.main === module) {
  main()
    .then(closePool)
    .then(process.exit)
    .catch(e => {
      console.log(e.stack);
    });
}
