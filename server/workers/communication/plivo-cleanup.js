/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import readline from 'readline';
import logger from '../../../common/helpers/logger';
import { getEntitiesByPrefix, removeEntities } from './adapters/plivoServiceAdapter';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = text =>
  new Promise(resolve =>
    rl.question(text, answer => {
      rl.close();
      resolve(answer);
    }),
  );

const format = (es, key) => (es.length && es.map(e => `\n${e[key]}`)) || '[none]';

const main = async () => {
  const prefix = process.argv[2];

  const entities = await getEntitiesByPrefix(prefix);

  const response = await question(`WARNING!

This will delete the following plivo applications:
${format(entities.applications, 'app_name')}

...and the following subaccounts:
${format(entities.subaccounts, 'name')}

...and their related endpoints:
${format(entities.endpoints, 'username')}

...and will assign to empty_application the following phone numbers:
${format(entities.affectedNumbers, 'number')}


Proceed? [y/N]
`);

  if (response.toLowerCase() !== 'y') return;
  return removeEntities(entities); // eslint-disable-line
};

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while cleaning up plivo', e);
        process.exit(1); // eslint-disable-line
  });
