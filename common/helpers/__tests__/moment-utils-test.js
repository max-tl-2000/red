/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as overrider from 'test-helpers/overrider';
import { LA_TIMEZONE } from '../../date-constants';
const { mockModules } = require('test-helpers/mocker').default(jest);
/* eslint-disable global-require */
describe('moment-utils', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => overrider.restore());
  describe('findLocalTimezone', () => {
    it('should guess the environment tz', () => {
      mockModules({
        'moment-timezone': { tz: { guess: () => 'GUESSED_TZ' } },
      });

      const { findLocalTimezone } = require('../moment-utils');

      const tz = findLocalTimezone();

      expect(tz).toEqual('GUESSED_TZ');
    });

    it('should guess the environment in unit tests', () => {
      const { findLocalTimezone } = require('../moment-utils');

      // this test will use the local timezone and will ensure unit tests are executed with TZ set to UTC
      const tz = findLocalTimezone();

      expect(tz).toEqual('UTC');
    });
  });

  describe('isValidTimezone', () => {
    it('should check if a timezone is valid', () => {
      const { isValidTimezone } = require('../moment-utils');
      expect(isValidTimezone('America/Los_Angeles')).toEqual(true);
    });

    it('should check reject an invalid one', () => {
      const { isValidTimezone } = require('../moment-utils');
      expect(isValidTimezone('America/Snoopy')).toEqual(false);
    });
  });

  describe('toMoment', () => {
    it('should return an invalid moment when called with null and warn about this issue', () => {
      const { toMoment } = require('../moment-utils');
      const mock = { warn: jest.fn() };
      overrider.override(console, mock);
      expect(toMoment(null).isValid()).toEqual(false);
      expect(mock.warn).toHaveBeenCalledTimes(1);
    });

    it('should return an invalid moment when called with undefined and warn about this issue', () => {
      const { toMoment } = require('../moment-utils');
      const mock = { warn: jest.fn() };
      overrider.override(console, mock);
      expect(toMoment(undefined).isValid()).toEqual(false);
      expect(mock.warn).toHaveBeenCalledTimes(1);
    });

    it('should return an invalid moment when called with empty string and warn about this issue', () => {
      const { toMoment } = require('../moment-utils');
      const mock = { warn: jest.fn() };
      overrider.override(console, mock);
      expect(toMoment('').isValid()).toEqual(false);
      expect(mock.warn).toHaveBeenCalledTimes(1);
    });
    describe('when process.env.NODE_ENV is development', () => {
      let toMoment;
      let consoleMock;

      beforeEach(() => {
        consoleMock = { warn: jest.fn() };
        overrider.override(console, consoleMock);
        overrider.override(process.env, { NODE_ENV: 'development' });
        toMoment = require('../moment-utils').toMoment;
      });

      it('should show warnings in the console about failing the strict full ISO validation and loose ISO validation', () => {
        expect(toMoment('2019-10-12 00:00:00').format()).toEqual('2019-10-12T00:00:00+00:00');
        // one warning for the non fullISO and loose formats
        // one warning with the stack trace
        expect(consoleMock.warn.mock.calls[0]).toEqual(['>> date parameter is not in any ISO format', '2019-10-12 00:00:00']);
        expect(consoleMock.warn).toHaveBeenCalledTimes(2);
      });

      it('should show warnings in the console about failing the strict full ISO validation', () => {
        expect(toMoment('2019-10-12').format()).toEqual('2019-10-12T00:00:00+00:00');
        // one warning for the non fullISO format
        // one warning with the stack trace
        expect(consoleMock.warn.mock.calls[0]).toEqual(['>> `date` parameter is not in full ISO format', '2019-10-12']);
        expect(consoleMock.warn).toHaveBeenCalledTimes(2);
      });
    });

    it('should convert to a valid moment a string representing a date (ISO format UTC)', () => {
      const { toMoment } = require('../moment-utils');
      const mock = { error: jest.fn(), warn: jest.fn() };
      overrider.override(console, mock);
      const date = toMoment('2017-12-12T07:00:00.000Z');

      expect(date.isValid()).toEqual(true);
      expect(date.toISOString()).toEqual('2017-12-12T07:00:00.000Z');
      expect(mock.error).toHaveBeenCalledTimes(0);
      expect(mock.warn).toHaveBeenCalledTimes(0);
    });

    it('should convert to a valid moment a string representing a date (ISO format with tz)', () => {
      const { toMoment } = require('../moment-utils');
      const mock = { error: jest.fn(), warn: jest.fn() };
      overrider.override(console, mock);

      // if the date contains a timezone this is respected
      const date = toMoment('2017-12-12T00:00:00-07:00');
      expect(date.isValid()).toEqual(true);
      expect(date.toISOString()).toEqual('2017-12-12T07:00:00.000Z');
      expect(mock.error).toHaveBeenCalledTimes(0);
      expect(mock.warn).toHaveBeenCalledTimes(0);
    });

    describe('when timezone is provided', () => {
      it('should convert to a valid moment a string representing a date (ISO format with tz)', () => {
        const { toMoment } = require('../moment-utils');
        const mock = { error: jest.fn(), warn: jest.fn() };
        overrider.override(console, mock);

        // if the date contains a timezone this is respected
        // and the provided date will be then converted to the provided
        // timezone
        const date = toMoment('2017-12-12T00:00:00-05:00', { timezone: LA_TIMEZONE });
        expect(date.isValid()).toEqual(true);
        expect(date.format()).toEqual('2017-12-11T21:00:00-08:00');
        expect(mock.error).toHaveBeenCalledTimes(0);
        expect(mock.warn).toHaveBeenCalledTimes(0);
      });

      it('should convert to a valid moment a string representing a date (ISO format UTC)', () => {
        const { toMoment } = require('../moment-utils');
        const mock = { error: jest.fn(), warn: jest.fn() };
        overrider.override(console, mock);

        // if the date contains a timezone this is respected
        // and the provided date will be then converted to the provided
        // timezone
        const date = toMoment('2017-12-12T05:00:00Z', { timezone: LA_TIMEZONE });
        expect(date.isValid()).toEqual(true);
        expect(date.format()).toEqual('2017-12-11T21:00:00-08:00');
        expect(mock.error).toHaveBeenCalledTimes(0);
        expect(mock.warn).toHaveBeenCalledTimes(0);
      });
    });
  });
});
