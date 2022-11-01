/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minimist from 'minimist';
import { ok, error, success, subtle } from './logger';
import execCommand from './exec-command';
import { getFilesThatChanged } from './changes-detector';
import { write } from '../common/helpers/xfs';
import { getListWithString } from '../common/helpers/list-utils';
import { now } from '../common/helpers/moment-utils';

const main = async () => {
  const argv = minimist(process.argv.slice(2));
  const noSkip = argv.noSkip || false;
  const testSuite = getListWithString(argv.testSuite) || '';

  const testSuites = ['other-servers', 'leasing-servers', 'comms-api', 'leasing-api', 'other-api', 'others'];
  const integrationSuiteCmd = './bnr exec-integration-report';
  let cmd = integrationSuiteCmd;

  for (const suite of testSuite) {
    if (testSuites.includes(suite)) {
      cmd = `${cmd} --testSuite ${suite}`;
    }
  }

  const changedFiles = await getFilesThatChanged();

  const filesDidNotChange = changedFiles.length === 0;

  subtle('Did integration files change?', !filesDidNotChange);

  if (filesDidNotChange && !noSkip) {
    const ts = now().format('YYYY-MM-DDTHH:mm:ss');

    const contents = `
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Mocha Tests no files changed" timestamp="${ts}" time="0" tests="0" failures="0">
</testsuites>
    `.trim();

    await write('./report_integration/test-results.xml', contents, {
      encoding: 'utf8',
    });
    ok('Nothing to do, files did not change so skipping integration tests');
    return;
  }

  subtle('changed files', JSON.stringify(changedFiles, null, 2));

  const cp = execCommand(cmd, { id: 'integration-test' });

  const finishedWithSuccess = await cp;

  if (!finishedWithSuccess) {
    throw new Error('Integration tests failure');
  }
};

main()
  .then(() => success('integration runner done!'))
  .catch(err => {
    error('integration runner', err);
    process.exit(1); // eslint-disable-line
  });
