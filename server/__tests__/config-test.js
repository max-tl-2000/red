/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('config', () => {
  afterEach(() => jest.resetModules());

  describe('when importing config', () => {
    it('exportPort should be defined and default to 3080', () => {
      mockModules({
        '../../common/helpers/globals.js': {
          process: {
            env: {
              CLOUD_ENV: 'tests',
            },
          },
        },
      });
      const cfg = require('../config').default;
      expect(cfg.exportPort).toEqual(3080);
    });

    it('exportPort should be set to the value of `EXPORT_PORT`', () => {
      mockModules({
        '../../common/helpers/globals.js': {
          process: {
            env: {
              CLOUD_ENV: 'tests',
              // env variables are strigns... but the envVal helper
              // parses then and convert them JS primitives when possible
              // like in this case.
              EXPORT_PORT: '2890',
            },
          },
        },
      });
      const cfg = require('../config').default;
      expect(cfg.exportPort).toEqual(2890);
    });
  });
});
