/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import _ from 'lodash'; // eslint-disable-line red/no-lodash
import { write } from '../common/helpers/xfs';

const main = async () => {
  const descriptions = process.argv[2];

  const sanitize = str =>
    str
      .replace("describe('", '')
      .replace('describe("', '')
      .replace('describe(`', '')
      .replace("it('", '')
      .replace('it("', '')
      .replace('it(`', '')
      .replace(', async () => {', '')
      .replace(', () => {', '')
      .slice(0, -1);

  const res = _(descriptions)
    .split('\n')
    .map(r => r.split('.js:'))
    .map(r => [r[0], sanitize(r[1])])
    .groupBy(r => r[0])
    .mapValues(tests => tests.map(t => t[1]).join('\n'))
    .toPairs()
    .map(p => `${p.join('\n')}\n`)
    .join('\n');

  await write('tests-descriptions.txt', res);
  console.info('Results written to tests-descriptions.txt');
};

main().catch(e => {
  console.error("An error ocurred while extracting tests' descrptions", e);
  process.exit(1); // eslint-disable-line
});
