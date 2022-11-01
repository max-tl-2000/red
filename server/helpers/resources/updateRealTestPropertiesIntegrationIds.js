/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minimist from 'minimist';
import { success, error, subtle } from 'clix-logger/logger';
import csvtojson from 'csvtojson';
import path from 'path';
import { toMoment } from '../../../common/helpers/moment-utils';
import { write } from '../../../common/helpers/xfs';

/**
 * Can be executed with the command
 * node_modules/.bin/babel-node --extensions '.ts,.js,.json' server/helpers/resources/updateRealTestPropertiesIntegrationIds.js --date <date> --filePath <filePath>
 * date param with format YYYY-MM-DD
 */
const main = async () => {
  const argv = minimist(process.argv.slice(2));
  const { date, filePath } = argv;
  subtle('Input parameters', { date, filePath });

  if (!date || !filePath) {
    error('Usage: update-real-test-properties-integration-ids.js [date] [filePath]');
    return;
  }

  const data = await csvtojson().fromFile(filePath);

  const dateToCompare = toMoment(date);

  const dataBeforeDateToCompare = data.filter(row => {
    const { leaseEndOn } = row;
    if (!leaseEndOn) return true;
    return toMoment(leaseEndOn).isSameOrAfter(dateToCompare);
  });

  const dataFormatted = dataBeforeDateToCompare
    .filter(({ code, propertyId }) => propertyId && code)
    .reduce((acc, item) => {
      const { propertyId, code } = item;
      acc[propertyId] = [...(acc[propertyId] || []), code];
      return acc;
    }, {});

  await write(path.join(__dirname, 'real-test-properties-integration-ids.json'), JSON.stringify(dataFormatted, null, 2));

  success('Done!');
};

if (require.main === module) {
  main().catch(e => {
    error(e);
  });
}
