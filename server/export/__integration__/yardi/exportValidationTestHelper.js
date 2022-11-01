/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fse from 'fs-extra';
import { expect } from 'chai';
import request from 'supertest';
import memoize from 'lodash/memoize';

import app from '../../../api/api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { validate } from './validator';

import { exportFolder } from '../exportTestHelper';

import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'export-test' });

export const parseCsv = file => {
  const entries = [];
  const rows = file.contents.split('\n');
  const keys = rows[1].split(',');

  for (let i = 2; i < rows.length; i++) {
    const obj = {};
    if (!rows[i]) break;
    const values = rows[i].split(',');

    for (let index = 0; index < keys.length; index++) {
      obj[keys[index]] = values[index];
    }
    entries.push(obj);
  }

  return {
    filename: file.filename,
    entries,
  };
};

const parseFolder = folder => {
  // TODO: Do not use Sync methods. As it blocks everything until done
  const files = fse.readdirSync(folder);
  const ordered = files.sort((a, b) => fse.statSync(path.join(folder, a)).mtime.getTime() - fse.statSync(path.join(folder, b)).mtime.getTime());

  return ordered
    .filter(file => file.toLowerCase() !== '.ds_store')
    .map(file => ({
      filename: file,
      contents: fse.readFileSync(path.join(folder, file)).toString(),
    }));
};

const getFileType = memoize(filePath => {
  const matchers = [
    {
      regex: /ResProspects/,
      value: 'ResProspects',
    },
    {
      regex: /ResRoommates/,
      value: 'ResRoommates',
    },
    {
      regex: /ResTenants/,
      value: 'ResTenants',
    },
  ];

  const match = matchers.find(m => filePath.match(m.regex));
  if (match) {
    return match.value;
  }

  return '';
});

export const compareWithBaselineFiles = async (baselineFolder, { isVoidedLease, daysFromNow = 0, timezone, overrides = {} } = {}) => {
  const expectedFiles = parseFolder(baselineFolder).map(file => parseCsv(file));

  const actualFiles = parseFolder(exportFolder).map(file => parseCsv(file));

  logger.info(
    'Expected files:',
    expectedFiles.map(f => f.filename),
  );
  logger.info(
    'Actual files:',
    actualFiles.map(f => f.filename),
  );
  expect(
    actualFiles.length,
    'Export files count mismatch. For each expected file type (ResTenants, ResProspects, etc) there should be an equivalent generated file.',
  ).to.equal(expectedFiles.length);

  const checkForErrorsReducer = ({ entry, actualFile, i, file } = {}) => (acc, key) => {
    const typeOfFile = getFileType(file.filename);
    const overridesObj = typeOfFile ? overrides[typeOfFile] || {} : {};
    const expected = overridesObj[key] || entry[key];
    const actual = actualFile.entries[i][key];

    const err = validate({
      baselineFilePath: path.join(baselineFolder, file.filename),
      actualFileName: actualFile.filename,
      key,
      expected,
      actual,
      isVoidedLease,
      daysFromNow,
      timezone,
    });

    if (err) {
      acc.push(err);
    }

    return acc;
  };

  expectedFiles.forEach(file => {
    // A baseline file name FinCharges-1 means search in the generate files by FinCharges and take the result at index zero
    const { filename } = file;
    const [type, index = 1] = filename.split('-');
    const actualFile = actualFiles.filter(f => f.filename.includes(type))[index - 1];

    for (let i = 0; i < file.entries.length; i++) {
      const entry = file.entries[i];
      const errors = Object.keys(entry).reduce(checkForErrorsReducer({ entry, actualFile, i, file }), []);

      expect(errors.join('\n')).to.deep.equal('');
    }
  });
};

export const closeParty = async (userId, partyId) =>
  await request(app)
    .post(`/parties/${partyId}/close`)
    .set(getAuthHeader(tenant.id, userId))
    .send({ closeReasonId: DALTypes.ClosePartyReasons.NO_LONGER_MOVING })
    .expect(200);

export const voidLease = async (userId, team, lease) =>
  await request(app)
    .post(`/parties/${lease.partyId}/leases/${lease.id}/void`)
    .set(getAuthHeader(tenant.id, userId, [team]))
    .send()
    .expect(200);

export const manualHoldUnit = async (userId, inventoryId, partyId, quoteId) =>
  await request(app)
    .post(`/inventories/${inventoryId}/holds`)
    .set(getAuthHeader(tenant.id, userId))
    .send({ reason: DALTypes.InventoryOnHoldReason.MANUAL, partyId, quotable: false, quoteId })
    .expect(200);

export const manualHoldReleaseUnit = async (userId, inventoryId, partyId) =>
  await request(app).delete(`/inventories/${inventoryId}/holds`).set(getAuthHeader(tenant.id, userId)).send({ partyId }).expect(200);
