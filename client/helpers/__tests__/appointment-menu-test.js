/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import { AppointmentCardMenuViewModel } from '../../containers/AppointmentList/AppointmentCardMenuViewModel';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now } from '../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../common/date-constants';

describe('Appointment section menu', () => {
  describe('Upcoming appointment', () => {
    let appointment;
    let instance;

    beforeEach(() => {
      const nowDate = now({ timezone: LA_TIMEZONE }).add(1, 'year');
      appointment = {
        id: 1,
        state: DALTypes.TaskStates.ACTIVE,
        metadata: {
          startDate: nowDate.clone(),
          endDate: nowDate.clone().add(30, 'min'),
          partyMembers: [],
          inventories: [],
        },
      };

      instance = new AppointmentCardMenuViewModel(appointment, LA_TIMEZONE);
    });

    describe('Appointment is not completed', () => {
      it('remove button should be visible', () => {
        expect(instance.isCancelVisible).to.be.true;
      });
      it('mark as completed should be visible and disabled', () => {
        expect(instance.isMarkAsCompleteVisible).to.be.true;
        expect(instance.isMarkAsCompleteEnabled).to.be.false;
      });
      it('unmark as completed should not be visible', () => {
        expect(instance.isUnMarkAsCompleteVisible).to.be.false;
      });
    });
  });

  describe('Past appointment', () => {
    let appointment;
    let instance;

    beforeEach(() => {
      const nowDate = now({ timezone: LA_TIMEZONE }).subtract(1, 'year');
      appointment = {
        id: 1,
        state: DALTypes.TaskStates.ACTIVE,
        metadata: {
          startDate: nowDate.clone(),
          endDate: nowDate.clone().add(30, 'min'),
          partyMembers: [],
          inventories: [],
        },
      };

      instance = new AppointmentCardMenuViewModel(appointment, LA_TIMEZONE);
    });

    // const appointment = {
    //   id: 1,
    //   state: DALTypes.TaskStates.ACTIVE,
    //   metadata: {
    //     startDate: parseAsInTimezone('2020-10-13 11:00:00', { format: 'YYYY-MM-DD HH:mm:ss', timezone: LA_TIMEZONE }),
    //     endDate: parseAsInTimezone('2020-10-13 11:30:00', { format: 'YYYY-MM-DD HH:mm:ss', timezone: LA_TIMEZONE }),
    //     partyMembers: [],
    //     inventories: [],
    //   },
    // };
    // const instance = new AppointmentCardMenuViewModel(appointment, LA_TIMEZONE);
    describe('Appointment is not completed', () => {
      it('remove button should be visible', () => {
        expect(instance.isCancelVisible).to.be.true;
      });
      it('mark as completed should be visible and enabled', () => {
        expect(instance.isMarkAsCompleteVisible).to.be.true;
        expect(instance.isMarkAsCompleteEnabled).to.be.true;
      });
      it('unmark as completed should not be visible', () => {
        expect(instance.isUnMarkAsCompleteVisible).to.be.false;
      });
    });

    describe('Appointment is completed', () => {
      let completedAppointmentVM;
      beforeEach(() => {
        const nowDate = now({ timezone: LA_TIMEZONE }).subtract(1, 'year');
        appointment = {
          id: 1,
          state: DALTypes.TaskStates.COMPLETED,
          metadata: {
            startDate: nowDate.clone(),
            endDate: nowDate.clone().add(30, 'min'),
            partyMembers: [],
            inventories: [],
          },
        };

        completedAppointmentVM = new AppointmentCardMenuViewModel(appointment, LA_TIMEZONE);
      });

      it('remove button should not be visible', () => {
        expect(completedAppointmentVM.isCancelVisible).to.be.false;
      });
      it('mark as completd button should not be visible', () => {
        expect(completedAppointmentVM.isMarkAsCompleteVisible).to.be.false;
      });
      it('unmark as completed button should be visible', () => {
        expect(completedAppointmentVM.isUnMarkAsCompleteVisible).to.be.true;
      });
    });
  });
});
