/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import app from '../../api';
import { createAUserAndTeam, toggleExtCalendarFeature } from '../../../testUtils/repoHelper';
import { getAuthHeader, setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import config from '../../../config';
import { setCalendarOps } from '../../../services/externalCalendars/providerApiOperations';
import { getRevaUserCalendarNames } from '../../../services/externalCalendars/cronofyServiceHelper';

chai.use(sinonChai);
const expect = chai.expect;

describe('API/webooks/externalCalendarDelegatedAccessCallback', () => {
  let isFirstCallForCreateRevaCalendar = true;
  const accessToken = 'some-access-token';

  const primaryCalendar = {
    provider_name: 'google',
    profile_id: 'profile-id',
    profile_name: 'qatest2@reva.tech',
    calendar_id: 'primary-calendar-id',
    calendar_name: 'Calendar',
    calendar_readonly: false,
    calendar_deleted: false,
    calendar_primary: true,
    permission_level: 'unrestricted',
  };

  const revaCalendar = {
    provider_name: 'google',
    profile_id: 'profile-id',
    profile_name: 'qatest2@reva.tech',
    calendar_id: 'reva-calendar-id',
    calendar_name: 'Reva - Appointments',
    calendar_readonly: false,
    calendar_deleted: false,
    calendar_primary: false,
    permission_level: 'unrestricted',
  };

  beforeEach(async () => {
    isFirstCallForCreateRevaCalendar = true;
    await toggleExtCalendarFeature(true);
  });

  afterEach(async () => await toggleExtCalendarFeature(false));

  const setup = async ({ createRevaCalendar = sinon.spy(() => revaCalendar) } = {}) => {
    const requestAccessToken = sinon.spy(() => ({ access_token: accessToken }));

    let isFirstCallForGetExternalCalendars = true;
    const getExternalCalendars = sinon.spy(() => {
      if (isFirstCallForGetExternalCalendars) {
        isFirstCallForGetExternalCalendars = false;
        return [primaryCalendar];
      }
      return [primaryCalendar, revaCalendar];
    });

    const createNotificationChannel = sinon.spy(() => {});
    const getEvents = sinon.spy(() => ({ pages: {}, events: [] }));
    setCalendarOps({ requestAccessToken, createRevaCalendar, getExternalCalendars, createNotificationChannel, getEvents });

    const userParams = { externalCalendars: { calendarAccount: 'user1@reva.tech', linking_profile: { profile_id: 'profile-id' } } };

    const {
      user: { id: userId },
    } = await createAUserAndTeam({ userParams });

    const postData = {
      authorization: {
        code: 'single-use-code',
        state: `User:${userId}`,
      },
    };

    return { createRevaCalendar, getExternalCalendars, createNotificationChannel, getEvents, postData, userParams };
  };

  describe('when receiving the single use code for a user', () => {
    it('should create a new calendar for him', async () => {
      const { createRevaCalendar, getExternalCalendars, createNotificationChannel, getEvents, postData, userParams } = await setup();

      const condition = msg => msg.code === 'single-use-code';
      const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

      const res = await request(app)
        .post(`/webhooks/externalCalendarDelegatedAccessCallback?token=${tenant.authorization_token}&api-token=${config.externalCalendarsApiToken}`)
        .send(postData)
        .set(getAuthHeader());

      await task;

      expect(res.status).to.equal(200);
      expect(createRevaCalendar).to.have.been.called.once;
      expect(getExternalCalendars).to.have.been.called.twice;
      expect(createNotificationChannel).to.have.been.called.twice;
      expect(getEvents).to.have.been.called.once;

      const calendarNames = getRevaUserCalendarNames();

      const createRevaCalendarParams = {
        profile_id: userParams.externalCalendars.linking_profile.profile_id, // eslint-disable-line camelcase
        name: calendarNames.primary,
        color: '#FF0000',
        accessToken,
      };

      expect(createRevaCalendar).to.have.been.calledWith(createRevaCalendarParams);
    });

    it('should create a calendar with name Reva - Tours when one with Reva - Appointments name cannot be created', async () => {
      const createRevaCalendarWithError = sinon.spy(() => {
        if (isFirstCallForCreateRevaCalendar) {
          isFirstCallForCreateRevaCalendar = false;
          throw new Error('some error');
        }
        return revaCalendar;
      });

      const { createRevaCalendar, postData, userParams } = await setup({ createRevaCalendar: createRevaCalendarWithError });

      const condition = msg => msg.code === 'single-use-code';
      const { task } = await setupQueueToWaitFor([condition], ['externalCalendars']);

      const res = await request(app)
        .post(`/webhooks/externalCalendarDelegatedAccessCallback?token=${tenant.authorization_token}&api-token=${config.externalCalendarsApiToken}`)
        .send(postData)
        .set(getAuthHeader());

      await task;

      expect(res.status).to.equal(200);
      expect(createRevaCalendar).to.have.been.called.twice;

      const calendarNames = getRevaUserCalendarNames();

      const createRevaCalendarParamsFirstCall = {
        profile_id: userParams.externalCalendars.linking_profile.profile_id, // eslint-disable-line camelcase
        name: calendarNames.primary,
        color: '#FF0000',
        accessToken,
      };

      const createRevaCalendarParamsSecondCall = {
        profile_id: userParams.externalCalendars.linking_profile.profile_id, // eslint-disable-line camelcase
        name: calendarNames.primary,
        color: '#FF0000',
        accessToken,
      };

      expect(createRevaCalendar).to.have.been.calledWith(createRevaCalendarParamsFirstCall);
      expect(createRevaCalendar).to.have.been.calledWith(createRevaCalendarParamsSecondCall);
    });
  });
});
