/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import { error, log } from 'clix-logger/logger';
import minimist from 'minimist';
import { write } from '../../../common/helpers/xfs';
import envVal from '../../../common/helpers/env-val';

let rasaxUrl = 'https://rasax.corp.reva.tech';

const getArgs = args => {
  const argv = minimist(args.slice(2));

  if (argv.rasaxUrl) {
    rasaxUrl = argv.rasaxUrl;
  }

  const conversationId = argv.conversationId;

  const defaultOutputFile = `cai-export-${conversationId}.json`;

  return {
    conversationId,
    output: argv.output || defaultOutputFile,
  };
};

const loginToRasaX = async authPayload => {
  let res;
  try {
    res = await request.post(`${rasaxUrl}/api/auth`).set('Content-Type', 'application/json').set('Accept', 'application/json').send(authPayload);
  } catch (err) {
    error(err?.response?.body);
  }
  return res?.body?.access_token;
};

const getReviewedImportedUtterances = async authToken => {
  let res;
  try {
    res = await request
      .get(`${rasaxUrl}/api/projects/default/training_examples`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${authToken}`);
  } catch (err) {
    error(err?.response?.body);
  }
  return res?.body;
};

const getImportedUtterances = async (authToken, conversationId) => {
  let res;
  try {
    res = await request
      .get(`${rasaxUrl}/api/projects/default/logs?exclude_training_data=false`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${authToken}`);
  } catch (err) {
    error(err?.response?.body);
  }
  return res?.body?.filter(u => u.conversation_id === conversationId);
};

/*
  Usage: RASAX_PASSWORD=[PASS] ./bnr export-cai-utterances --conversationId=<dac27152-add6-11eb-b575-dbab27e6c557>

  Options:
    --conversationId=<dac27152-add6-11eb-b575-dbab27e6c557> set the conversation id
      used to identify the import

    --output=<file/path/export.json> set output file path
      defaults to <cai-export-conversationId>.json

    --rasaxUrl=<http://rasax.reva.tech> set the rasa server url,
      defaults to https://rasax.corp.reva.tech
*/
const main = async args => {
  const { conversationId, output } = getArgs(args);

  if (!conversationId) throw new Error('--conversationId is required!');

  const rasaxPassword = envVal('RASAX_PASSWORD', '');

  const authToken = await loginToRasaX({ username: 'me', password: rasaxPassword });

  const importedUtterances = await getImportedUtterances(authToken, conversationId);
  const reviewedImportedUtterances = await getReviewedImportedUtterances(authToken);

  let utterancesToExport = importedUtterances
    .filter(iu => reviewedImportedUtterances.some(riu => riu.hash === iu.hash))
    .map(iu => ({ ...iu, review: reviewedImportedUtterances.find(riu => riu.hash === iu.hash) }));

  if (utterancesToExport) {
    utterancesToExport = JSON.stringify(utterancesToExport, null, 2);
    await write(output, utterancesToExport);
    log(utterancesToExport);
  }
};

main(process.argv)
  .then(process.exit)
  .catch(err => {
    error(err);
    process.exit(1); // eslint-disable-line no-process-exit
  });
