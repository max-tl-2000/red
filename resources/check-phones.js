/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Transform, pipeline as pipe } from 'stream';
import { prepareRawQuery } from '../server/common/schemaConstants';
import { parsePhone } from '../common/helpers/phone/phone-helper';
import { deferred } from '../common/helpers/deferred';
import { mkdirp, write } from '../common/helpers/xfs';
import execp from './execp';

export const getPhonesCount = async (knex, { tenantId, filterPossiblyInvalid }) => {
  let query = 'SELECT count(*) FROM db_namespace."ContactInfo" where type = \'phone\'';

  if (filterPossiblyInvalid) {
    query += " and char_length(value) <> 11 and value not like '1%'";
  }

  const res = await knex.raw(prepareRawQuery(query, tenantId));

  return res?.rows?.[0]?.count;
};

export const getTenants = async knex => {
  const result = await knex.raw('SELECT * from admin."Tenant"');

  return result?.rows;
};

const verifyPhonesInContactInfo = async (knex, { tenantId, filterPossiblyInvalid = false }) => {
  const totalPhones = await getPhonesCount(knex, { tenantId, filterPossiblyInvalid });

  let query = 'select id, value, "personId", metadata from db_namespace."ContactInfo" where type = \'phone\'';

  if (filterPossiblyInvalid) {
    query += " and char_length(value) <> 11 and value not like '1%'";
  }

  console.log(`>> about to process: "${totalPhones}" phones in total`);

  const phonesStream = knex.raw(prepareRawQuery(query, tenantId)).stream();

  const invalidPhones = [];

  const transformStream = new Transform({
    objectMode: true,
    autoDestroy: true,
    transform: (chunk, encoding, callback) => {
      try {
        const { value: phone, id: contactInfoId, metadata, ...rest } = chunk;
        const { valid } = parsePhone(phone);
        if (!valid) {
          invalidPhones.push({ phone, contactInfoId, ...rest, metadata: JSON.stringify(metadata) });
          callback();
          return;
        }

        callback();
      } catch (err) {
        callback(err);
      }
    },
  });

  const d = deferred();

  pipe(phonesStream, transformStream, err => {
    if (err) {
      d.reject(err);
    }
    d.resolve();
  });

  await d;

  return { totalPhones, invalidPhones };
};

export const checkPhones = async () => {
  const { knex } = require('../server/database/factory');

  const tenants = await getTenants(knex);

  await execp('rm -rf ./phones-report');
  await mkdirp('./phones-report/');

  for (let i = 0; i < tenants.length; i++) {
    const { id, name } = tenants[i];
    console.log(`>>> analyzing tenant ${name}`);

    const { invalidPhones, totalPhones } = await verifyPhonesInContactInfo(knex, { tenantId: id });

    console.log(`>>> Invalid phones for tenant: ${name} ${invalidPhones.length} out of ${totalPhones}`);
    const headers = `<tr><th>${['phone', 'contactInfoId', 'personId', 'metadata'].join('</th><th>')}</th></tr>`;
    const rows = invalidPhones.map(entry => `<tr><td>${Object.values(entry).join('</td><td>')}</td></tr>`);
    const data = `<table>${[headers, ...rows].join('\n')}</table>`;
    await write(`./phones-report/report-${name}.html`, data);
  }
};

const main = async () => {
  await checkPhones();
  process.exit(0); // eslint-disable-line no-process-exit
};

main().catch(err => console.error('>>> err', err));
