/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';
import { testCtx as ctx, createATeam, toggleExtCalendarFeature } from '../../testUtils/repoHelper';
import { now } from '../../../common/helpers/moment-utils';
import { isDuringOfficeHours } from '../teams';
import '../../testUtils/setupTestGlobalContext';
import { saveTeamEvent } from '../../dal/calendarEventsRepo';
import { UTC_TIMEZONE, LA_TIMEZONE } from '../../../common/date-constants';

chai.use(sinonChai);
const expect = chai.expect;

describe('team availability', () => {
  const addAteam = async ({ name, start, end } = {}) =>
    await createATeam({
      name,
      externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() },
      officeHours: {
        Monday: { startTimeOffsetInMin: start, endTimeOffsetInMin: end },
        Tuesday: { startTimeOffsetInMin: start, endTimeOffsetInMin: end },
        Wednesday: { startTimeOffsetInMin: start, endTimeOffsetInMin: end },
        Thursday: { startTimeOffsetInMin: start, endTimeOffsetInMin: end },
        Friday: { startTimeOffsetInMin: start, endTimeOffsetInMin: end },
        Saturday: { startTimeOffsetInMin: start, endTimeOffsetInMin: end },
        Sunday: { startTimeOffsetInMin: start, endTimeOffsetInMin: end },
      },
    });

  const startOfFriday = now({ timezone: LA_TIMEZONE }).startOf('day').startOf('week').add(5, 'days');

  describe('given a team', () => {
    describe('without calendar integration', () => {
      describe('when the current time is same as office hours start', () => {
        it('should return true', async () => {
          // 07:00:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(7, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.true;
        });
      });

      describe('when the current time is after office hours start', () => {
        it('should return true', async () => {
          // 07:15:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(7, 'hours').add(15, 'minutes');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.true;
        });
      });

      describe('when the current time is same as office hours end', () => {
        it('should return false', async () => {
          // 16:00:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(16, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.false;
        });
      });

      describe('when the current time is after office hours end', () => {
        it('should return false', async () => {
          // 16:10:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(16, 'hours').add(10, 'minutes');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00
          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.false;
        });
      });
    });

    describe('with calendar integration enabled and a calendar account set but no external events for the selected date', () => {
      describe('when the current time is same as office hours start', () => {
        it('should return true', async () => {
          await toggleExtCalendarFeature(true);
          //  07:00:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(7, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.true;
        });
      });

      describe('when the current time is after office hours start', () => {
        it('should return true', async () => {
          // 07:15:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(7, 'hours').add(15, 'minutes');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.true;
        });
      });

      describe('when the current time is same as office hours end', () => {
        it('should return false', async () => {
          // 16:00:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(16, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00
          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.false;
        });
      });

      describe('when the current time is after office hours end', () => {
        it('should return false', async () => {
          // 16:10:00.000 Los_Angeles time
          const friday = startOfFriday.clone().add(16, 'hours').add(10, 'minutes');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00
          const isInOfficeHours = await isDuringOfficeHours(ctx, team, friday);
          expect(isInOfficeHours).to.be.false;
        });
      });
    });

    describe('with calendar integration enabled and a calendar account set and external events for the selected date', () => {
      describe('when the current time is same as the start of one of the events', () => {
        it('should return false', async () => {
          await toggleExtCalendarFeature(true);
          const tomorrow = now({ timezone: UTC_TIMEZONE }).startOf('day').add(1, 'days');

          // 14:00:00.000 UTC time => 07:00:00.000 Los_Angeles time
          const tomorrowSlot = tomorrow.clone().add(7, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          await saveTeamEvent(ctx, {
            teamId: team.id,
            startDate: tomorrow.clone().add(7, 'hours'),
            endDate: tomorrow.clone().add(14, 'hours'),
            externalId: 'external-event-id',
          });

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, tomorrowSlot);
          expect(isInOfficeHours).to.be.false;
        });
      });

      describe('when the current time is outside team events', () => {
        it('should return true', async () => {
          await toggleExtCalendarFeature(true);
          const tomorrow = now({ timezone: UTC_TIMEZONE }).startOf('day').add(1, 'days');

          // 14:00:00.000 UTC time => 07:00:00.000 Los_Angeles time
          const tomorrowSlot = tomorrow.clone().add(17, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          await saveTeamEvent(ctx, {
            teamId: team.id,
            startDate: tomorrow.clone().add(7, 'hours'),
            endDate: tomorrow.clone().add(14, 'hours'),
            externalId: 'external-event-id',
          });

          await saveTeamEvent(ctx, {
            teamId: team.id,
            startDate: tomorrow.clone().add(19, 'hours'),
            endDate: tomorrow.clone().add(22, 'hours'),
            externalId: 'external-event-id2',
          });

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, tomorrowSlot);
          expect(isInOfficeHours).to.be.true;
        });
      });

      describe('when the current time is inside team events', () => {
        it('should return false', async () => {
          await toggleExtCalendarFeature(true);
          const tomorrow = now({ timezone: UTC_TIMEZONE }).startOf('day').add(1, 'days');

          const tomorrowSlot = tomorrow.clone().add(21, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          await saveTeamEvent(ctx, {
            teamId: team.id,
            startDate: tomorrow.clone().add(7, 'hours'),
            endDate: tomorrow.clone().add(14, 'hours'),
            externalId: 'external-event-id',
          });

          await saveTeamEvent(ctx, {
            teamId: team.id,
            startDate: tomorrow.clone().add(19, 'hours'),
            endDate: tomorrow.clone().add(22, 'hours'),
            externalId: 'external-event-id2',
          });

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, tomorrowSlot);
          expect(isInOfficeHours).to.be.false;
        });
      });

      describe('when the current time is same as office hours end', () => {
        it('should return false', async () => {
          await toggleExtCalendarFeature(true);
          const tomorrow = now({ timezone: UTC_TIMEZONE }).startOf('day').add(1, 'days');

          // 14:00:00.000 UTC time => 07:00:00.000 Los_Angeles time
          const tomorrowSlot = tomorrow.clone().add(14, 'hours');

          const team = await addAteam({ name: 'team1', start: 420, end: 960 }); // 7:00 -> 16:00

          await saveTeamEvent(ctx, {
            teamId: team.id,
            startDate: tomorrow.clone().add(7, 'hours'),
            endDate: tomorrow.clone().add(14, 'hours'),
            externalId: 'external-event-id',
          });

          const isInOfficeHours = await isDuringOfficeHours(ctx, team, tomorrowSlot);
          expect(isInOfficeHours).to.be.false;
        });
      });
    });
  });
});
