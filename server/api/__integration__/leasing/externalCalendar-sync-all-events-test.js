/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';

import app from '../../api';
import { testCtx as ctx, createAUserAndTeam, toggleExtCalendarFeature } from '../../../testUtils/repoHelper';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { setCalendarOps } from '../../../services/externalCalendars/providerApiOperations';
import { createResolverMatcher, chan } from '../../../testUtils/setupTestGlobalContext';
import { createExternalEvent, createExternalAllDayEvent } from '../../../testUtils/externalCalendars';
import { DATE_ISO_FORMAT, now } from '../../../../common/helpers/moment-utils';
import { getAllTeamEvents, getAllUserEvents } from '../../../dal/calendarEventsRepo';
import { setupConsumers } from '../../../workers/consumer';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/events', () => {
  let user;
  let team;
  let teamSingleEvent;
  let userPrivateEventTime;
  const seedData = async () => {
    const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', primaryCalendarId: newId() } };
    const teamParams = { externalCalendars: { calendarAccount: 'team@reva.tech', teamCalendarId: newId() } };

    const { user: user1, team: team1 } = await createAUserAndTeam({ userParams, teamParams });

    user = user1;
    team = team1;
    await toggleExtCalendarFeature(true);

    const { teamCalendarId } = team.externalCalendars;
    const { primaryCalendarId: userCalendarId } = user.externalCalendars;

    const tomorrow = now().add(1, 'days').format(DATE_ISO_FORMAT);
    const twoDays = now().add(2, 'days').format(DATE_ISO_FORMAT);

    userPrivateEventTime = `${tomorrow}T08:00:00Z`;
    const userPrivateEventTime2 = `${tomorrow}T09:00:00Z`;
    teamSingleEvent = `${tomorrow}T04:00:00Z`;

    const getEvents = sinon.spy(payload => {
      const {
        calendar_ids: [calendarId],
      } = payload;
      if (calendarId === teamCalendarId) {
        return {
          events: [createExternalAllDayEvent({ startDate: twoDays, numberOfDays: 1 }), createExternalEvent(teamSingleEvent, 60)],
          pages: {},
        };
      }

      if (calendarId === userCalendarId) {
        return { events: [createExternalEvent(userPrivateEventTime, 60), createExternalEvent(userPrivateEventTime2, 60)], pages: {} };
      }
      return { events: [], pages: {} };
    });

    setCalendarOps({ getEvents });
  };

  beforeEach(async () => {
    await seedData();
  });
  afterEach(async () => await toggleExtCalendarFeature(false));

  describe('when syncing external calendar events data for a user', () => {
    describe('and external calendar integration is enabled', () => {
      describe('and the integration was done', () => {
        it('adds the external events to the userCalendarEvents table', async () => {
          const condition = msg => msg.tenantId === ctx.tenantId;
          const {
            resolvers,
            promises: [waitForFirstSync, waitForSecondSync],
          } = waitFor([condition, condition]);
          const matcher = createResolverMatcher(resolvers);
          await setupConsumers(chan(), matcher, ['externalCalendars']);

          await request(app).get('/externalCalendars/externalCalendarEventsSync').set(getAuthHeader()).expect(200);

          await waitForFirstSync;

          const userEvents = await getAllUserEvents(ctx, user.id);
          const teamEvents = await getAllTeamEvents(ctx, team.id);

          expect(userEvents.length).to.equal(2);
          expect(teamEvents.length).to.equal(2);

          const getEvents = sinon.spy(payload => {
            const {
              calendar_ids: [calendarId],
            } = payload;
            if (calendarId === team.externalCalendars.teamCalendarId) {
              return {
                events: [createExternalEvent(teamSingleEvent, 60)],
                pages: {},
              };
            }

            if (calendarId === user.externalCalendars.primaryCalendarId) {
              return { events: [createExternalEvent(userPrivateEventTime, 60)], pages: {} };
            }
            return { events: [], pages: {} };
          });

          setCalendarOps({ getEvents });
          await request(app).get('/externalCalendars/externalCalendarEventsSync').set(getAuthHeader()).expect(200);

          await waitForSecondSync;

          const userEvents2 = await getAllUserEvents(ctx, user.id);
          const teamEvents2 = await getAllTeamEvents(ctx, team.id);

          expect(userEvents2.length).to.equal(1);
          expect(teamEvents2.length).to.equal(1);
        });
      });
    });
  });
});
