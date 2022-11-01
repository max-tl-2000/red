/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { testCtx as ctx, createAUser, createUserEvent as createUserPersonalEvent, toggleExtCalendarFeature } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { importEmployees } from '../inventory/employee';
import { getUsers } from '../../dal/usersRepo';
import { getUserEvents } from '../../dal/calendarEventsRepo';
import { getOneWhere } from '../../database/factory';
import { setupQueueToWaitFor } from '../../testUtils/apiHelper';
import { setCalendarOps } from '../../services/externalCalendars/providerApiOperations';
import { getCronofyConfigs } from '../../helpers/tenantContextConfigs';
import { CalendarTargetType } from '../../../common/enums/calendarTypes';
import { getTenantData } from '../../dal/tenantsRepo';

chai.use(sinonChai);
const expect = chai.expect;

const CALENDAR_TOPICS = ['externalCalendars'];

describe('inventory/employees', () => {
  describe('when importing a new emplyee', () => {
    it('will save the employee', async () => {
      const employee1 = {
        userUniqueId: '123',
        registrationEmail: 'test@revatech.com',
        fullName: 'Bill Smith',
        businessTitle: 'Leasing Consultant',
        preferredName: 'Bill',
        employmentType: 'permanent',
        calendarAccount: '',
      };
      const employee2 = {
        userUniqueId: '321',
        registrationEmail: 'user2@revatech.com',
        fullName: 'Sara Jones',
        businessTitle: 'Leasing Consultant',
        preferredName: 'Sara',
        employmentType: 'permanent',
        calendarAccount: '',
      };

      const employeeRows = [
        {
          data: employee1,
          index: 1,
        },
        {
          data: employee2,
          index: 2,
        },
      ];
      await importEmployees(ctx, employeeRows);

      const users = await getUsers(ctx);
      expect(users.length).to.equal(3);

      const dbFirstUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId: employee1.userUniqueId });
      expect(dbFirstUser.fullName).to.equal(employee1.fullName);
      const dbSecondUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId: employee2.userUniqueId });
      expect(dbSecondUser.fullName).to.equal(employee2.fullName);
    });
  });

  describe('when importing an already imported employee', () => {
    it('will update the existing', async () => {
      const employeeData = {
        userUniqueId: '123',
        registrationEmail: 'test@revatech.com',
        fullName: 'Bill Smith',
        businessTitle: 'Leasing Consultant',
        preferredName: 'Bill',
        employmentType: 'permanent',
        calendarAccount: '',
      };

      const employeeRow = [
        {
          data: employeeData,
          index: 1,
        },
      ];

      await importEmployees(ctx, employeeRow);

      const dbUsers = await getUsers(ctx);
      expect(dbUsers.length).to.equal(2);
      const dbUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId: employeeData.userUniqueId });
      expect(dbUser.fullName).to.equal(employeeData.fullName);
      expect(dbUser.employmentType).to.equal(employeeData.employmentType);

      const updatedEmployeeData = {
        ...employeeData,
        preferredName: 'Bylly',
        employmentType: 'partTime',
      };

      const updatedEmployeeRow = [
        {
          data: updatedEmployeeData,
          index: 1,
        },
      ];

      await importEmployees(ctx, updatedEmployeeRow);

      const dbUpdatedUsers = await getUsers(ctx);
      expect(dbUpdatedUsers.length).to.equal(2);
      const dbUpdatedUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId: employeeData.userUniqueId });
      expect(dbUpdatedUser.preferredName).to.equal(updatedEmployeeData.preferredName);
      expect(dbUpdatedUser.employmentType).to.equal(updatedEmployeeData.employmentType);
    });
  });

  describe('when external calendar integration is enabled and', () => {
    describe('importing an employee with updated external calendar account', () => {
      it(`will make the requests to cronofy for old account to remove events from reva calendar, close notification channel and
      revoke account authorization then will remove user personal events from database table and request to delegate access for new account`, async () => {
        const dbUserWithCalendar = await createAUser({
          externalCalendars: {
            calendarAccount: 'bill@revatech.com',
            revaCalendarId: '123321',
            notificationChannels: [{ channel: { channel_id: '1' } }],
            refresh_token: '1',
            access_token: 'at1',
          },
        });
        const { id: userId, externalUniqueId, email, fullName } = dbUserWithCalendar;

        const eventStartDate = '2018-01-01';
        await createUserPersonalEvent({
          userId,
          startDate: eventStartDate,
          endDate: '2018-02-01',
        });

        const userEvents = await getUserEvents(ctx, userId, eventStartDate);
        expect(userEvents.length).to.be.equal(1);

        const updatedEmployeeData = {
          userUniqueId: externalUniqueId,
          registrationEmail: email,
          fullName,
          businessTitle: 'Leasing Consultant',
          preferredName: 'Bill',
          employmentType: 'permanent',
          calendarAccount: 'billisor@revatech.com',
        };

        const employeeRow = [
          {
            data: updatedEmployeeData,
            index: 1,
          },
        ];

        await toggleExtCalendarFeature(true);

        const removeAllEvents = sinon.spy();
        const closeNotificationChannel = sinon.spy();
        const revokeAuthorization = sinon.spy();
        const requestDelegatedAccess = sinon.spy();
        setCalendarOps({ removeAllEvents, closeNotificationChannel, revokeAuthorization, requestDelegatedAccess });

        const { task: extCalendarMessage } = await setupQueueToWaitFor([msg => msg.userExternalUniqueId === externalUniqueId], CALENDAR_TOPICS);
        await importEmployees(ctx, employeeRow);
        await extCalendarMessage;

        const { clientId, clientSecret, delegatedAccessUrl } = await getCronofyConfigs(ctx);
        const {
          metadata: { externalCalendars },
        } = await getTenantData(ctx);

        expect(removeAllEvents).to.have.been.calledOnce;
        const { revaCalendarId, access_token: accessToken, notificationChannels, refresh_token: refreshToken } = dbUserWithCalendar.externalCalendars;
        expect(removeAllEvents).to.have.been.calledWith({ calendarIds: [revaCalendarId], accessToken });

        expect(closeNotificationChannel).to.have.been.calledOnce;
        expect(closeNotificationChannel).to.have.been.calledWith({ channelId: notificationChannels[0].channel.channel_id, accessToken });

        expect(revokeAuthorization).to.have.been.calledOnce;
        expect(revokeAuthorization).to.have.been.calledWith({ clientId, clientSecret, refreshToken });

        const updatedUserEvents = await getUserEvents(ctx, userId, eventStartDate);
        expect(updatedUserEvents.length).to.be.equal(0);
        const updatedUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId });
        expect(updatedUser.externalCalendars.calendarAccount).to.be.equal(updatedEmployeeData.calendarAccount);

        expect(requestDelegatedAccess).to.have.been.calledOnce;
        expect(requestDelegatedAccess).to.have.been.calledWith({
          accessToken: externalCalendars.access_token,
          emailAddress: updatedEmployeeData.calendarAccount,
          callbackUrl: delegatedAccessUrl,
          state: `${CalendarTargetType.USER}:${userId}`,
        });

        await toggleExtCalendarFeature(false);
      });
    });

    describe('importing an employee with updated external calendar account and full name', () => {
      it(`will make the requests to cronofy for old account to remove events from reva calendar, close notification channel and
      revoke account authorization then will remove user personal events from database table and request to delegate access for new account`, async () => {
        const dbUserWithCalendar = await createAUser({
          fullName: 'full name 1',
          externalCalendars: {
            calendarAccount: 'bill@revatech.com',
            revaCalendarId: '123321',
            notificationChannels: [{ channel: { channel_id: '1' } }],
            refresh_token: '1',
            access_token: 'at1',
          },
        });
        const { id: userId, externalUniqueId, email } = dbUserWithCalendar;

        const eventStartDate = '2018-01-01';
        await createUserPersonalEvent({
          userId,
          startDate: eventStartDate,
          endDate: '2018-02-01',
        });

        const userEvents = await getUserEvents(ctx, userId, eventStartDate);
        expect(userEvents.length).to.be.equal(1);

        const updatedEmployeeData = {
          userUniqueId: externalUniqueId,
          registrationEmail: email,
          fullName: 'full name 2',
          businessTitle: 'Leasing Consultant',
          preferredName: 'Bill',
          employmentType: 'permanent',
          calendarAccount: 'billisor@revatech.com',
        };

        const employeeRow = [
          {
            data: updatedEmployeeData,
            index: 1,
          },
        ];

        await toggleExtCalendarFeature(true);

        const removeAllEvents = sinon.spy();
        const closeNotificationChannel = sinon.spy();
        const revokeAuthorization = sinon.spy();
        const requestDelegatedAccess = sinon.spy();
        setCalendarOps({ removeAllEvents, closeNotificationChannel, revokeAuthorization, requestDelegatedAccess });

        const { task: extCalendarMessage } = await setupQueueToWaitFor([msg => msg.userExternalUniqueId === externalUniqueId], CALENDAR_TOPICS);
        await importEmployees(ctx, employeeRow);
        await extCalendarMessage;

        const { clientId, clientSecret, delegatedAccessUrl } = await getCronofyConfigs(ctx);
        const {
          metadata: { externalCalendars },
        } = await getTenantData(ctx);

        expect(removeAllEvents).to.have.been.calledOnce;
        const { revaCalendarId, access_token: accessToken, notificationChannels, refresh_token: refreshToken } = dbUserWithCalendar.externalCalendars;
        expect(removeAllEvents).to.have.been.calledWith({ calendarIds: [revaCalendarId], accessToken });

        expect(closeNotificationChannel).to.have.been.calledOnce;
        expect(closeNotificationChannel).to.have.been.calledWith({ channelId: notificationChannels[0].channel.channel_id, accessToken });

        expect(revokeAuthorization).to.have.been.calledOnce;
        expect(revokeAuthorization).to.have.been.calledWith({ clientId, clientSecret, refreshToken });

        const updatedUserEvents = await getUserEvents(ctx, userId, eventStartDate);
        expect(updatedUserEvents.length).to.be.equal(0);
        const updatedUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId });
        expect(updatedUser.externalCalendars.calendarAccount).to.be.equal(updatedEmployeeData.calendarAccount);

        expect(requestDelegatedAccess).to.have.been.calledOnce;
        expect(requestDelegatedAccess).to.have.been.calledWith({
          accessToken: externalCalendars.access_token,
          emailAddress: updatedEmployeeData.calendarAccount,
          callbackUrl: delegatedAccessUrl,
          state: `${CalendarTargetType.USER}:${userId}`,
        });

        await toggleExtCalendarFeature(false);
      });
    });
  });
});
