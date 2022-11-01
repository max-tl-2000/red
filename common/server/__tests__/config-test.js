/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { expect } from 'chai';
import { createConfig } from '../create-config';
import { overrider } from '../../test-helpers';
import * as globals from '../../helpers/globals';

describe('create-config', () => {
  let ov;

  afterEach(() => jest.resetModules());

  it('should load development config by default', () => {
    ov = overrider.create(globals);
    ov.override('process', {
      env: {
        CLOUD_ENV: 'unittest',
      },
    });

    const config = createConfig({
      configsDir: path.resolve(__dirname, './fixtures/configs'),
    });

    expect(config.isProduction).to.be.false;
    expect(config.app.name).to.equal('Core Property Management - Dev');
  });

  it('should load production config if NODE_ENV is set to production', () => {
    ov = overrider.create(globals);
    ov.override('process', {
      env: {
        CLOUD_ENV: 'unittest',
        NODE_ENV: 'production',
      },
    });

    const config = createConfig({
      configsDir: path.resolve(__dirname, './fixtures/configs'),
    });

    expect(config.isProduction).to.be.true;
  });

  it('should prevent to assign values that does not exist in base', () => {
    expect(() => {
      ov = overrider.create(globals);
      ov.override('process', {
        env: {
          CLOUD_ENV: 'unittest',
          NODE_ENV: 'development',
        },
      });

      const development = require('./fixtures/configs/development'); // eslint-disable-line
      overrider.create(development, true).override('invalidKey', 'This key only exists in development');

      createConfig({
        configsDir: path.resolve(__dirname, './fixtures/configs'),
      });
    }).to.throw('key "invalidKey" is not present in the base object');
  });

  it('should allow override values in base config', () => {
    ov = overrider.create(globals);
    ov.override('process', {
      env: {
        CLOUD_ENV: 'unittest',
        NODE_ENV: 'development',
      },
    });

    const development = require('./fixtures/configs/development'); // eslint-disable-line
    const production = require('./fixtures/configs/production'); // eslint-disable-line

    overrider.create(production, true).override('foo', { bar: 'base value' });
    overrider.create(development, true).override('foo', { bar: 'development value' });

    const config = createConfig({
      configsDir: path.resolve(__dirname, './fixtures/configs'),
    });

    expect(config.foo.bar).to.equal('development value');
  });

  it('should fail when CLOUD_ENV is not set', () => {
    const spy = jest.fn();

    ov = overrider.create(globals);
    ov.override('process', {
      exit: spy,
      env: {
        NODE_ENV: 'production',
      },
    });

    createConfig({ configsDir: path.resolve(__dirname, './fixtures/configs') });

    expect(spy.mock.calls.length).to.equal(1);

    // calls arguments are in the internal array
    // and we want to expect that the exit call
    // was called with a code equal to 2
    expect(spy.mock.calls[0][0]).to.equal(2);
  });
});
