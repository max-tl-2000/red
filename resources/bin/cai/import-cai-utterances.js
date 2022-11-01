/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uuid from 'uuid/v4';
import csv from 'fast-csv';
import fs from 'fs';
import request from 'superagent';
import { error, log } from 'clix-logger/logger';
import minimist from 'minimist';
import config from '../../../server/decision_service/config';
import { write } from '../../../common/helpers/xfs';

const { rasa } = config;

let rasaUrl = 'http://10.10.20.36:5005'; // demo-staging

const getArgs = args => {
  const argv = minimist(args.slice(2));

  if (argv.rasaUrl) {
    rasaUrl = argv.rasaUrl;
  }

  const defaultConversationId = uuid();
  const conversationId = argv.conversationId || defaultConversationId;

  return {
    input: argv.input || 'utterances.csv',
    output: argv.output || `cai-import-${conversationId}.json`,
    conversationId,
  };
};

const readUtterancesCsvFile = async input => {
  const result = new Promise(resolve => {
    const stream = fs.createReadStream(input);
    const utterances = [];
    csv
      .fromStream(stream, { ignoreEmpty: true, trim: true })
      .on('data', data => {
        utterances.push(data);
      })
      .on('end', () => {
        resolve(utterances);
      });
  });
  return result;
};

const initConversation = async conversationId => {
  let res;
  try {
    res = request
      .post(`${rasaUrl}/conversations/${conversationId}/trigger_intent`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send({
        name: 'demo_init',
        entities: [
          {
            init: [
              {
                partyId: uuid(),
                propertyId: uuid(),
                propertyDisplayName: 'Skyline Chateau',
                teamId: uuid(),
                personDetails: { name: '', phone: '16502736663' },
              },
            ],
          },
        ],
      });

    if (rasa.authToken) {
      res.set('Authorization', `Bearer ${rasa.authToken}`);
    }

    await res;
  } catch (err) {
    error(res?.response?.body);
    return null;
  }
  return res?.response?.body;
};

const importUtterances = async (utterance, conversationId) => {
  let res;
  try {
    res = request
      .post(`${rasaUrl}/webhooks/rest/webhook`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send({ sender: conversationId, message: utterance?.[0] });

    if (rasa.authToken) {
      res.set('Authorization', `Bearer ${rasa.authToken}`);
    }

    await res;
  } catch (err) {
    error(res?.response?.body);
  }
  return res?.response?.body;
};

/*
  Usage: RASA_AUTH_TOKEN=[TOKEN] ./bnr import-cai-utterances

  Options:
    --input=<file/path/utterances.csv> set which csv file to process,
      defaults to utterances.csv in the root of the project

    --output=<file/path/import.json> set output file path
      defaults to <cai-import-conversationId>.json>

    --conversationId=<uuid> set the import conversation id
      default to <uuid>

    --rasaUrl=<http://rasa.reva.tech> set the rasa server url,
      defaults to http://10.10.20.36:5005 (demo-staging)
*/
const main = async args => {
  const { input, output, conversationId } = getArgs(args);
  const utterances = await readUtterancesCsvFile(input);

  log('Conversation Id: ', conversationId);

  let results = await initConversation(conversationId);
  if (results) {
    log('Init conversation: ', JSON.stringify(results, null, 2));

    results = await Promise.all(utterances.map(async u => importUtterances(u, conversationId)));
    results = JSON.stringify(results, null, 2);

    await write(output, results);
    log(results);
  }
};

main(process.argv)
  .then(process.exit)
  .catch(err => {
    error(err);
    process.exit(1); // eslint-disable-line no-process-exit
  });
