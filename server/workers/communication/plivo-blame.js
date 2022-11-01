/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chalk from 'chalk';
import _ from 'lodash'; // eslint-disable-line red/no-lodash
import logger from '../../../common/helpers/logger';
import { getAllNumbersAndAssociatedApps } from './adapters/plivoServiceAdapter';

const main = async () => {
  const format = length => str => str + ' '.repeat(Math.max(length - str.length, 0));
  const formatNumber = format(15);
  const formatName = format(15);
  const formatApp = format(60);

  const numbers = await getAllNumbersAndAssociatedApps();

  console.log(chalk.bold.green(`${formatName('Env Name')} ${formatNumber('Phone Number')} ${formatApp('Application')}`));

  const ns = _(numbers)
    .groupBy(n => n.app)
    .toPairs()
    .map(e => e[1])
    .sortBy(g => -g.length)
    .flatten()
    .value();

  ns.forEach(({ envName, number, app }) => console.log(formatName(envName), formatNumber(number), formatApp(app)));
};

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while executing plivo-blame', e);
        process.exit(1); // eslint-disable-line
  });
