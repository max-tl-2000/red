/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as momentUtils from 'helpers/moment-utils';
import { toMoment } from '../../moment-utils';

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('isValidDOB', () => {
  let isValidDOB;
  beforeEach(() => {
    mockModules({
      i18next: {
        t: (...args) => args, // we just want to log what we receive to compare the values
      },
      '../../../../common/helpers/moment-utils': {
        ...momentUtils,
        now: () => toMoment('07/01/2017', { parseFormat: 'MM/DD/YYYY' }), // mock a current now moment set to a known date
      },
    });
    isValidDOB = require('../dob').isValidDOB; // eslint-disable-line
  });

  describe('when only a partial value of the date is entered', () => {
    it('should show the error message accordingly', () => {
      const res = isValidDOB({ value: '01' });
      expect(res).toMatchSnapshot();
    });
  });

  describe('when a valid value is entered', () => {
    it('should return true', () => {
      const res = isValidDOB({ value: '01/01/1979' });
      expect(res).toEqual(true);
    });
  });

  describe('when a date is before the min valid year', () => {
    it('should produce an error message and show the valid range', () => {
      const res = isValidDOB({ value: '01/01/1111' });
      expect(res).toMatchSnapshot();
    });
  });

  describe('when the applicant is not 18 years old', () => {
    it('should produce an error telling the user he needs to be at least 18', () => {
      const res = isValidDOB({ value: '01/01/2002' });
      expect(res).toMatchSnapshot();
    });
  });
});
