/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('getStartAppCommand', () => {
  let getStartAppCommand;

  beforeEach(() => {
    jest.resetModules();

    mockModules({
      path: {
        resolve: p => p,
      },
    });

    getStartAppCommand = require('../getStartAppCommand').default;
  });

  it('it should create a command to execute the app in development mode by default', () => {
    const fn = getStartAppCommand('./bin/server', {
      NODE_PATH: './server',
      RED_PROCESS_NAME: 'leasing-server',
      PORT: 3000,
      API_PORT: 3030,
    });
    expect(fn({ args: {} })).toMatchSnapshot();
  });

  it('if production is set the NODE_ENV should be production', () => {
    const fn = getStartAppCommand('./bin/server', {
      NODE_PATH: './server',
      RED_PROCESS_NAME: 'leasing-server',
      PORT: 3000,
      API_PORT: 3030,
    });
    expect(fn({ args: { production: true } })).toMatchSnapshot();
  });
  it('if production is set the NODE_ENV should be integration', () => {
    const fn = getStartAppCommand('./bin/server', {
      NODE_PATH: './server',
      RED_PROCESS_NAME: 'leasing-server',
      PORT: 3000,
      API_PORT: 3030,
    });
    expect(fn({ args: { integration: true } })).toMatchSnapshot();
  });

  it('should set RED_LOGGER_STDOUT to false in case quiet option is set', () => {
    const fn = getStartAppCommand('./bin/server', {
      NODE_PATH: './server',
      RED_PROCESS_NAME: 'leasing-server',
      PORT: 3000,
      API_PORT: 3030,
    });
    expect(fn({ args: { quiet: true } })).toMatchSnapshot();
  });

  it('should RED_LOGGER_STDOUT also when production is true even if quiet was specified', () => {
    const fn = getStartAppCommand('./bin/server', {
      NODE_PATH: './server',
      RED_PROCESS_NAME: 'leasing-server',
      PORT: 3000,
      API_PORT: 3030,
    });
    expect(fn({ args: { quiet: true, production: true } })).toMatchSnapshot();
  });

  it('should create a command to start an app in debug mode', () => {
    const fn = getStartAppCommand('./bin/server', {
      NODE_PATH: './server',
      RED_PROCESS_NAME: 'leasing-server',
      PORT: 3000,
      API_PORT: 3030,
    });
    expect(fn({ args: { quiet: true, debug: true } })).toMatchSnapshot();
  });

  it('should create a command to start an app in debug mode with debugBrk set if required as well as a different port', () => {
    const fn = getStartAppCommand('./bin/server', {
      NODE_PATH: './server',
      RED_PROCESS_NAME: 'leasing-server',
      PORT: 3000,
      API_PORT: 3030,
    });
    expect(fn({ args: { quiet: true, debug: true, debugPort: 9888, debugBrk: true } })).toMatchSnapshot();
  });
});
