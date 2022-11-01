/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import xml2js from 'xml2js';
import minimist from 'minimist';
import request from 'superagent';
import { error as logError, log, ok } from 'clix-logger/logger';
import { expect } from 'chai';
import { fillHandlebarsTemplate } from '../../../common/helpers/handlebars-utils';
import { read } from '../../../common/helpers/xfs';
import config from '../config';
import tryParse from '../../../common/helpers/try-parse';
import { DSInputBuilder } from '../adapters/builders/DSInputBuilder';

const { corticonServerUrl } = config;
const serviceUrl = `${corticonServerUrl}/services/Corticon`;
const SUCCESS = 0;
const FAILURE = 1;
let DEBUG_MODE = false;

const parseXmlResult = (payload, explicitArray = true) => {
  const parser = new xml2js.Parser({ explicitArray, trim: true });
  return new Promise((resolve, reject) => {
    parser.parseString(payload, (error, result) => {
      if (error) {
        return reject(error);
      }

      return resolve(result);
    });
  });
};

const buildRequestBody = async (dsName, dsInput) => {
  let body;
  try {
    const requestTemplate = await read(path.join(__dirname, '../adapters/templates', 'request-template.xml'), 'utf8');
    body = await fillHandlebarsTemplate(requestTemplate, { dsName, ...dsInput }, { increment: val => val + 1 });
  } catch (error) {
    throw error;
  }
  return body;
};

const getJSONFromFile = async (type, fileName) => {
  let json;
  try {
    json = tryParse(await read(path.join(__dirname, type, fileName), 'utf8'));
  } catch (error) {
    throw error;
  }
  return json;
};

const getPartyDocumentFixture = async fixtureName => await getJSONFromFile('fixtures', fixtureName);

const getDSOutputSnapshot = async snapshotName => await read(path.join(__dirname, 'snapshots', snapshotName), 'utf8');

const testDS = async (ctx, dsName, partyDocument) => {
  const party = await getPartyDocumentFixture(partyDocument);

  const dsInput = new DSInputBuilder().build(ctx, party);
  const body = await buildRequestBody(dsName, dsInput);

  if (DEBUG_MODE) {
    log('Party Document', party);
    log('DS Input', dsInput);
    log('Request Body', body);
  }

  let res;
  let result = SUCCESS;
  try {
    res = await request.post(serviceUrl).set('Content-Type', 'text/xml;charset=UTF-8').send(body);

    const { text: dsOutput } = res;
    DEBUG_MODE && log('DS Output', dsOutput.replace(/^\s*[\r\n]/gm, ''));

    const dsOutputSnapshot = await getDSOutputSnapshot(`${partyDocument.split('.')[0]}.xml`);

    expect(await parseXmlResult(dsOutput)).to.deep.equal(await parseXmlResult(dsOutputSnapshot));
  } catch (err) {
    logError(err.message);
    result = FAILURE;
  }

  return result;
};

const getArgs = args => {
  const { partyDocument, dsName, debugMode } = minimist(args.slice(2));
  if (!dsName) throw new Error('--dsName argument is required');
  if (!partyDocument) throw new Error('--partyDocument argument is required');

  DEBUG_MODE = debugMode ? true : debugMode;

  return {
    dsName,
    partyDocument,
    debugMode,
  };
};

const main = async args => {
  const { dsName, partyDocument } = getArgs(args);
  const ctx = {};

  return await testDS(ctx, dsName, partyDocument);
};

main(process.argv)
  .then(exitCode => {
    exitCode === SUCCESS && ok('Decision service request successful!');
    exitCode === FAILURE && logError('Decision service request failed!');
    process.exit(exitCode); // eslint-disable-line no-process-exit
  })
  .catch(err => {
    logError(err);
    process.exit(1); // eslint-disable-line no-process-exit
  });
