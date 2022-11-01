/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sinon from 'sinon';
import { DALTypes } from '../../enums/DALTypes';
import { createMoveInFilter } from '../filters';
import { toMoment } from '../moment-utils';

describe('execute createMoveInFilter function', () => {
  let clock;
  const timezoneArgs = { timezone: 'America/Los_Angeles' };

  beforeEach(() => {
    const m = toMoment('2018-02-21T14:30:00Z', timezoneArgs);
    clock = sinon.useFakeTimers(m.valueOf());
  });

  afterEach(() => {
    clock.restore();
  });

  describe('given a NEXT_4_WEEKS moveInTime', () => {
    it('should return a valid filter', () => {
      const result = createMoveInFilter(DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS, timezoneArgs);
      expect(result).toMatchSnapshot();
    });
  });

  describe('given a NEXT_2_MONTHS moveInTime', () => {
    it('should return a valid filter', () => {
      const result = createMoveInFilter(DALTypes.QualificationQuestions.MoveInTime.NEXT_2_MONTHS, timezoneArgs);
      expect(result).toMatchSnapshot();
    });
  });

  describe('given a NEXT_4_MONTHS moveInTime', () => {
    it('should return a valid filter', () => {
      const result = createMoveInFilter(DALTypes.QualificationQuestions.MoveInTime.NEXT_4_MONTHS, timezoneArgs);
      expect(result).toMatchSnapshot();
    });
  });

  describe('given a BEYOND_4_MONTHS moveInTime', () => {
    it('should return a valid filter', () => {
      const result = createMoveInFilter(DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS, timezoneArgs);
      expect(result).toMatchSnapshot();
    });
  });

  describe('given a I_DONT_KNOW moveInTime', () => {
    it('should return a valid filter', () => {
      const result = createMoveInFilter(DALTypes.QualificationQuestions.MoveInTime.I_DONT_KNOW, timezoneArgs);
      expect(result).toEqual({ min: '', max: '' });
    });
  });

  describe('given a null moveInTime', () => {
    it('should a empty filter', () => {
      const result = createMoveInFilter(null);
      expect(result).toEqual({ min: '', max: '' });
    });
  });
});
