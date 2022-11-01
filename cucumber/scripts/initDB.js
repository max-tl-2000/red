/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { error, ok } from 'clix-logger/logger';
import { createE2Etenant, initSocketConn } from '../support/dbHelper';

const main = async () => {
  await initSocketConn();
  await createE2Etenant();
};

main()
  .then(() => {
    ok('tenant creation done!');
    process.exit(0); // eslint-disable-line
  })
  .catch(err => {
    error('tenant creation error', err?.message);
    process.exit(1); // eslint-disable-line
  });
