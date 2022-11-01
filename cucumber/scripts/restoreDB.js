/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { error, ok } from 'clix-logger/logger';
import { restoreFromBackup } from '../support/dbHelper';

const main = async () => {
  // restore the state from the backup for easy testing of a known state
  await restoreFromBackup(['./testcafe/bks/commonbk.sql', './testcafe/bks/e2e-tenant.sql']);
};

main()
  .then(() => {
    ok('restore tenant done!');
    process.exit(0); // eslint-disable-line
  })
  .catch(err => {
    error('restore tenant error', err);
    process.exit(1); // eslint-disable-line
  });
