/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const setMocks = () => {
  // Any modules that either consume resources that won't be
  // available during server unit tests or that auto execute code
  // should be mocked to avoid having memory leaks as we manually
  // clear the cache on some jest tests.
  jest.mock('../../server/database/factory');
  jest.mock('../../common/helpers/logger');
  jest.mock('../../server/services/pubsub');
  jest.mock('../../server/database/knex');
};

// this is needed so all instances of the factory module
// imported at the top of the files actually receive the mock instance
// instead of the real one
setMocks();

beforeEach(() => {
  // we need to set the mocks again
  // because we just reset the module cache
  setMocks();
});
