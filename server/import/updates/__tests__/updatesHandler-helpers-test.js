/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sinon from 'sinon';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { DATE_US_FORMAT, LA_TIMEZONE } from '../../../../common/date-constants';
import { parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { shouldMapInventoryState, getInventoryState } from '../updatesHandler';

describe('updatesHandler-helpers', () => {
  let clock;
  const timezone = LA_TIMEZONE;
  const getAvailabilityDate = date => parseAsInTimezone(date, { format: DATE_US_FORMAT, timezone });

  const setUpFakeTime = minutes => {
    const time = parseAsInTimezone('06/07/2018', { format: DATE_US_FORMAT, timezone }).startOf('day').add(minutes, 'minutes');
    clock = sinon.useFakeTimers(time.valueOf());
  };

  const assertContionToMapState = ({ result, ...row }) => {
    const newInventoryState = result.newState || row.state;
    it(result.shouldMapState ? `should map inventory state from ${row.state} into ${newInventoryState}` : 'should not map inventory state', () => {
      const mapInventoryState = shouldMapInventoryState(row, timezone, row.backendMode || DALTypes.BackendMode.NONE);
      const inventoryState = getInventoryState(row, timezone, row.backendMode || DALTypes.BackendMode.NONE);
      expect(mapInventoryState).toEqual(result.shouldMapState);
      expect(inventoryState).toEqual(newInventoryState);
    });
  };

  const commonScenarios = [
    {
      state: DALTypes.InventoryState.OCCUPIED,
      result: {
        shouldMapState: false,
      },
    },
    {
      state: DALTypes.InventoryState.VACANT_READY,
      result: {
        shouldMapState: false,
      },
    },
    {
      availabilityDate: getAvailabilityDate('06/08/2018'),
      state: DALTypes.InventoryState.OCCUPIED,
      result: {
        shouldMapState: false,
      },
    },
    {
      availabilityDate: getAvailabilityDate('06/06/2018'),
      state: DALTypes.InventoryState.VACANT_READY_RESERVED,
      result: {
        shouldMapState: false,
      },
    },
    {
      availabilityDate: getAvailabilityDate('06/09/2018'),
      state: DALTypes.InventoryState.VACANT_READY_RESERVED,
      backendMode: DALTypes.BackendMode.MRI,
      result: {
        shouldMapState: true,
        newState: DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED,
      },
    },
    {
      availabilityDate: getAvailabilityDate('06/07/2018'),
      state: DALTypes.InventoryState.VACANT_READY,
      result: {
        shouldMapState: false,
      },
    },
  ];

  describe('shouldMapInventoryState MRI', () => {
    describe('when the upload time is before the 6:00 PM', () => {
      beforeEach(() => {
        setUpFakeTime(1079); // 5:59 PM
      });

      afterEach(() => {
        clock.restore();
      });

      [
        ...commonScenarios,
        {
          availabilityDate: getAvailabilityDate('06/08/2018'),
          state: DALTypes.InventoryState.VACANT_READY,
          backendMode: DALTypes.BackendMode.MRI,
          result: {
            shouldMapState: true,
            newState: DALTypes.InventoryState.VACANT_MAKE_READY,
          },
        },
      ].forEach(element => assertContionToMapState(element));
    });

    describe('when the upload time is after the 6:00 PM', () => {
      beforeEach(() => {
        setUpFakeTime(1081); // 6:01 PM
      });

      afterEach(() => {
        clock.restore();
      });

      [
        ...commonScenarios,
        {
          availabilityDate: getAvailabilityDate('06/08/2018'),
          state: DALTypes.InventoryState.VACANT_READY,
          result: {
            shouldMapState: false,
          },
        },
      ].forEach(element => assertContionToMapState(element));
    });
  });

  describe('shouldMapInventoryState Yardi', () => {
    describe('when the upload time is before the 6:00 PM', () => {
      beforeEach(() => {
        setUpFakeTime(1079); // 5:59 PM
      });

      afterEach(() => {
        clock.restore();
      });

      [
        {
          ...commonScenarios[4],
        },
      ].forEach(element => assertContionToMapState(element));
    });
  });
});
