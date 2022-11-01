/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { inventoryStateFutureDate } from '../inventory';
import { DALTypes } from '../../../common/enums/DALTypes';

describe('inventoryStateFutureDate method', () => {
  const inventoryData = {
    propertyTimezone: 'America/Los_Angeles',
  };

  const generateNextStartDateTestCase = ({ availabilityDateSource, stateStartDate, result, availabilityDate }) => {
    const message = availabilityDate
      ? 'Should return the availabilityDate when availabilityDateSource is EXTERNAL'
      : 'Should return stateStartDate when availabilityDateSource is REVA';
    it(message, () => {
      const nextStateStartDate = inventoryStateFutureDate({
        ...inventoryData,
        stateStartDate,
        availabilityDate,
        availabilityDateSource,
      });
      expect(nextStateStartDate.date()).to.equal(result);
    });
  };

  describe('When availabilityDateSource is REVA', () => {
    [
      {
        stateStartDate: '2018-05-24T08:00:00.00Z',
        result: 24,
      },
      {
        stateStartDate: '2018-05-30T07:59:59.809Z',
        result: 30,
      },
      {
        stateStartDate: '2018-05-31T16:00:00.809Z',
        result: 31,
      },
    ].forEach(data => {
      generateNextStartDateTestCase({
        ...data,
        availabilityDateSource: DALTypes.AvailabilityDateSourceType.REVA,
      });
    });
  });

  describe('When availabilityDateSource is EXTERNAL', () => {
    [
      {
        availabilityDate: '2018-05-01T13:00:00.809Z',
        result: 1,
      },
      {
        availabilityDate: '2018-05-24T16:00:00.809Z',
        result: 24,
      },
    ].forEach(data => {
      generateNextStartDateTestCase({
        ...data,
        availabilityDateSource: DALTypes.AvailabilityDateSourceType.EXTERNAL,
      });
    });
  });
});
