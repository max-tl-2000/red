/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

let execCount = 0;
const fx = fixture('test');

fx.beforeEach(() => {
  execCount++;
  console.log('>>> beforeEach', execCount);
});

fx.afterEach(() => {
  console.log('>>> afterEach', execCount);
});

// Skip the retry test because we currently run with REVA_RETRY_FAILED_TEST=0, and
// the below assumes it is set to 4
test.skip('test', async () => {
  console.log('>>> executing test', execCount);

  if (execCount < 3) {
    throw new Error('Dummy error');
  }
});
