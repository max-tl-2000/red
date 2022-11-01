/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('addTimeFnsToBunyan', () => {
  let BunyanFakeClass;
  let addTimeFnsToBunyan;

  beforeEach(() => {
    BunyanFakeClass = function BunyanFakeConstructor() {};

    BunyanFakeClass.prototype.trace = jest.fn();
  });
  afterEach(() => jest.resetModules());

  it('should add two methods to provided Class', () => {
    addTimeFnsToBunyan = require('../enhance-bunyan').addTimeFnsToBunyan;

    addTimeFnsToBunyan(BunyanFakeClass);

    const instance = new BunyanFakeClass();
    expect(typeof instance.time).toEqual('function');
    expect(typeof instance.timeEnd).toEqual('function');
  });

  it('when invoked one after the other they should keep track of how much time has passed between one call and another', () => {
    const getNowMock = jest.fn();
    // simulate a time difference of 1000 ms
    getNowMock.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    mockModules({
      '../date-helper.js': {
        getNow: getNowMock,
      },
    });

    addTimeFnsToBunyan = require('../enhance-bunyan').addTimeFnsToBunyan;

    addTimeFnsToBunyan(BunyanFakeClass);

    const instance = new BunyanFakeClass();

    instance.time('someLabel');
    instance.timeEnd('someLabel');

    expect(BunyanFakeClass.prototype.trace).toHaveBeenCalledWith({ info: { duration: 1000, name: 'someLabel' } }, 'someLabel, 1000ms');
  });

  describe('when invoked with a wrong timer', () => {
    it('should not throw and trace should not be called', () => {
      const getNowMock = jest.fn();
      // simulate a time difference of 1000 ms
      getNowMock.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      mockModules({
        '../date-helper.js': {
          getNow: getNowMock,
        },
      });

      addTimeFnsToBunyan = require('../enhance-bunyan').addTimeFnsToBunyan;

      addTimeFnsToBunyan(BunyanFakeClass);

      const instance = new BunyanFakeClass();

      instance.time('someLabel');
      instance.timeEnd('someLabel2');

      expect(BunyanFakeClass.prototype.trace).not.toHaveBeenCalled();
    });
  });

  describe('to keep parity with other bunyan functions', () => {
    it('should accept an object as the first argument as well', () => {
      const getNowMock = jest.fn();
      // simulate a time difference of 1000 ms
      getNowMock.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      mockModules({
        '../date-helper.js': {
          getNow: getNowMock,
        },
      });

      addTimeFnsToBunyan = require('../enhance-bunyan').addTimeFnsToBunyan;

      addTimeFnsToBunyan(BunyanFakeClass);

      const instance = new BunyanFakeClass();

      instance.time({}, 'someLabel');
      instance.timeEnd({}, 'someLabel');

      expect(BunyanFakeClass.prototype.trace).toHaveBeenCalledWith({ info: { duration: 1000, name: 'someLabel' } }, 'someLabel, 1000ms');
    });

    it('if the object contain more info it is just passed to the trace function', () => {
      const getNowMock = jest.fn();
      // simulate a time difference of 1000 ms
      getNowMock.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      mockModules({
        '../date-helper.js': {
          getNow: getNowMock,
        },
      });

      addTimeFnsToBunyan = require('../enhance-bunyan').addTimeFnsToBunyan;

      addTimeFnsToBunyan(BunyanFakeClass);

      const instance = new BunyanFakeClass();

      const ctx = { tenantId: '89c45b50-5722-42c7-b3fc-167f0a267d2e' };

      instance.time({ ctx }, 'someLabel');
      instance.timeEnd({ ctx }, 'someLabel');

      expect(BunyanFakeClass.prototype.trace).toHaveBeenCalledWith(
        {
          ctx: {
            tenantId: '89c45b50-5722-42c7-b3fc-167f0a267d2e',
          },
          info: { duration: 1000, name: 'someLabel' },
        },
        'someLabel, 1000ms',
      );
    });
  });
});
