/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as momentUtils from 'helpers/moment-utils';
import { toMoment, now } from '../moment-utils';
import { DALTypes } from '../../enums/DALTypes';

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('lease helper', () => {
  describe('When calling the canVoidLease function', () => {
    const agent = { email: 'bill@reva.tech' };
    const timezone = 'America/Chicago';
    let canVoidLease;
    beforeEach(() => {
      mockModules({
        '../moment-utils.ts': {
          ...momentUtils,
          now: () => toMoment('11/15/2018', { parseFormat: 'MM/DD/YYYY', timezone: 'America/Chicago' }),
        },
      });
      canVoidLease = require('../lease').canVoidLease; // eslint-disable-line global-require
    });

    it('should be able to void a lease when the leaseStartDate is today at 23:59:59', () => {
      const lease = {
        status: DALTypes.LeaseStatus.EXECUTED,
        baselineData: {
          timezone,
          publishedLease: {
            leaseStartDate: toMoment('11/16/2018', { parseFormat: 'MM/DD/YYYY', timezone: 'America/Chicago' }).startOf('day').subtract(1, 'second'),
          },
        },
      };
      expect(canVoidLease(lease, agent)).toEqual(true);
    });

    it('should be able to void a lease when the leaseStartDate is today at 00:00:00', () => {
      const lease = {
        status: DALTypes.LeaseStatus.EXECUTED,
        baselineData: {
          timezone,
          publishedLease: {
            leaseStartDate: toMoment('11/15/2018', { parseFormat: 'MM/DD/YYYY', timezone: 'America/Chicago' }).startOf('day'),
          },
        },
      };
      expect(canVoidLease(lease, agent)).toEqual(true);
    });

    it('should not be able to void a lease when the leaseStartDate was yesterday at 23:59:59', () => {
      const lease = {
        status: DALTypes.LeaseStatus.EXECUTED,
        baselineData: {
          timezone,
          publishedLease: {
            leaseStartDate: toMoment('11/15/2018', { parseFormat: 'MM/DD/YYYY', timezone: 'America/Chicago' }).startOf('day').subtract(1, 'second'),
          },
        },
      };
      expect(canVoidLease(lease, agent)).toEqual(false);
    });

    it('should return true when the leaseStartDate is today at 13:00:00', () => {
      const lease = {
        status: DALTypes.LeaseStatus.EXECUTED,
        baselineData: {
          timezone,
          publishedLease: {
            leaseStartDate: toMoment('11/15/2018 13:00:00', { parseFormat: 'MM/DD/YYYY HH:mm:ss', timezone: 'America/Chicago' }),
          },
        },
      };
      expect(canVoidLease(lease, agent)).toEqual(true);
    });

    it('should return true when the leaseStartDate is in 2 days from now', () => {
      const lease = {
        status: DALTypes.LeaseStatus.EXECUTED,
        baselineData: {
          timezone,
          publishedLease: {
            leaseStartDate: toMoment('11/17/2018', { parseFormat: 'MM/DD/YYYY', timezone: 'America/Chicago' }),
          },
        },
      };
      expect(canVoidLease(lease, agent)).toEqual(true);
    });

    it('should be able to void a lease when the leaseStartDate was yesterday at 23:59:59 but the user is the reva admin', () => {
      const revaAdmin = { email: 'admin@reva.tech' };
      const lease = {
        status: DALTypes.LeaseStatus.EXECUTED,
        baselineData: {
          timezone,
          publishedLease: {
            leaseStartDate: toMoment('11/15/2018', { parseFormat: 'MM/DD/YYYY', timezone: 'America/Chicago' }).startOf('day').subtract(1, 'second'),
          },
        },
      };
      expect(canVoidLease(lease, revaAdmin)).toEqual(true);
    });

    it('should be able to void a lease when the leaseMoveInDate was yesterday at 00:00:00 but the user is the reva admin', () => {
      const revaAdmin = { email: 'admin@reva.tech' };
      const lease = {
        status: DALTypes.LeaseStatus.EXECUTED,
        baselineData: {
          timezone,
          publishedLease: {
            leaseMoveInDate: now().subtract(1, 'day'),
          },
        },
      };
      expect(canVoidLease(lease, revaAdmin)).toEqual(true);
    });
  });
});
