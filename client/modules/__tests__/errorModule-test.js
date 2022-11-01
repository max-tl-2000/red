/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { override, restore } from '../../../common/test-helpers/overrider';

const { mockModules } = require('../../../common/test-helpers/mocker').default(jest);

describe('errorModule', () => {
  let windowMock;
  let consoleMock;
  let logger;

  beforeEach(() => {
    windowMock = {
      __events: {},
      navigator: { userAgent: 'Mock User Agent' },
      location: { href: 'https://mock/location/to/resource' },
      addEventListener: jest.fn((evt, handler) => (windowMock.__events[evt] = handler)),
    };

    logger = { error: jest.fn(), warn: jest.fn() };
    consoleMock = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

    override(console, consoleMock);

    mockModules({
      '../../../common/helpers/globals': {
        window: windowMock,
      },
    });
  });

  afterEach(() => {
    jest.resetModules();
    restore();
  });

  it('should throw if no apiClient is provided', () => {
    const { initErrorModule } = require('../errorModule');

    const fn = () => initErrorModule();

    expect(fn).toThrowErrorMatchingSnapshot();
  });

  it('should throw if no id is provided', () => {
    const { initErrorModule } = require('../errorModule');

    const fn = () => initErrorModule(logger, {});

    expect(fn).toThrowErrorMatchingSnapshot();
  });

  describe('skipping known errors', () => {
    it('should skip logging errors if they are prevented by CORS policy', () => {
      const { initErrorModule } = require('../errorModule');

      initErrorModule(logger, { id: 'mockId' });

      windowMock.onerror('Script error.', '', 0, 0, null);

      expect(consoleMock.log).toHaveBeenCalledWith('Ignored error', 'Script error.', {});

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should skip logging errors if it match the "ResizeObserver loop limit exceeded"', () => {
      const { initErrorModule } = require('../errorModule');

      initErrorModule(logger, { id: 'mockId' });

      windowMock.onerror('ResizeObserver loop limit exceeded', '', 0, 0, null);

      expect(consoleMock.warn).toHaveBeenCalledWith('Ignored error', 'ResizeObserver loop limit exceeded', {});

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should skip logging errors if it match the "Blocked a frame with origin"', () => {
      const { initErrorModule } = require('../errorModule');

      initErrorModule(logger, { id: 'mockId' });

      windowMock.onerror('Blocked a frame with origin', '', 0, 0, null);

      expect(consoleMock.warn).toHaveBeenCalledWith('Ignored error', 'Blocked a frame with origin', {});

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  it('should call logger.error if an error is received with a proper Error object', () => {
    const { initErrorModule } = require('../errorModule');

    initErrorModule(logger, { id: 'mockId' });
    const mockError = {
      message: 'This is a mock error',
      stack: `
        This is a mock stack at file:10:1
        This is another mock at file:20:1
      `,
    };

    windowMock.onerror('An interesting error', 'some/path/to/file', 17, 20, mockError);

    expect(logger.error.mock.calls).toMatchSnapshot();
  });

  it('should call the old onerror handler if one was defined', () => {
    const { initErrorModule } = require('../errorModule');
    const oldHandler = jest.fn();

    windowMock.onerror = oldHandler;

    initErrorModule(logger, { id: 'mockId' });

    windowMock.onerror('An interesting error', 'some/path/to/file', 17, 20, null);

    expect(oldHandler).toHaveBeenCalled();
  });

  it('should add a listener to `unhandledrejection` event', async () => {
    const { initErrorModule } = require('../errorModule');

    initErrorModule(logger, { id: 'mockId' });

    windowMock.__events.unhandledrejection({
      promise: {},
      reason: 'error',
    });

    expect(logger.error.mock.calls).toMatchSnapshot();
  });

  it('in production unhandled rejections should not be printed to console', async () => {
    override(process.env, { NODE_ENV: 'production' });
    // this is achieved by calling e.preventDefault(); so in this case we will just check
    // that preventDefault was called
    const { initErrorModule } = require('../errorModule');

    initErrorModule(logger, { id: 'mockId' });
    const args = { promise: {}, reason: 'error', preventDefault: jest.fn() };
    windowMock.__events.unhandledrejection(args);

    expect(args.preventDefault).toHaveBeenCalled();
  });
});
