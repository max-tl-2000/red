/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { mapSeries } from 'bluebird';
import range from 'lodash/range';
import {
  testCtx as ctx,
  createATeam,
  createVoiceMessages,
  createAUser,
  toggleExtCalendarFeature,
  createUserEvent as createUserPersonalEvent,
  createATeamMember,
} from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { importTeamMembers } from '../inventory/teamMembers';
import { importEmployees } from '../inventory/employee';
import { getTeamMembers, getTeamMembersToExport } from '../../dal/teamsRepo';
import { updateUser } from '../../dal/usersRepo';
import { getTenantReservedPhoneNumbers, updateTenantPhoneNumbers, getTenantData } from '../../dal/tenantsRepo';
import { getOneWhere } from '../../database/factory';
import { isPhoneValid } from '../../../common/helpers/validations/phone';
import { setCalendarOps } from '../../services/externalCalendars/providerApiOperations';
import { setupQueueToWaitFor } from '../../testUtils/apiHelper';
import { getCronofyConfigs } from '../../helpers/tenantContextConfigs';
import { CalendarTargetType } from '../../../common/enums/calendarTypes';
import { getUserEvents } from '../../dal/calendarEventsRepo';

const CALENDAR_TOPICS = ['externalCalendars'];
chai.use(sinonChai);
const expect = chai.expect;

describe('inventory/temMembers', () => {
  let team;
  let voiceMessage;
  let user;
  let user1;
  beforeEach(async () => {
    team = await createATeam({
      name: 'testTeam1',
      module: 'leasing',
      email: 'leasing_email1',
      phone: '16504375757',
    });
    voiceMessage = await createVoiceMessages();
    user = await createAUser();
    user1 = await createAUser();
  });

  describe('when importing a new team member', () => {
    it('will save the team member', async () => {
      const firstTeamMember = {
        team: team.name,
        userUniqueId: user.externalUniqueId,
        roles: 'LA, LD',
        directEmailIdentifier: 'user',
        outsideDedicatedEmails: 'user@reva.tech',
        directPhoneIdentifier: '%phone[0]%',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };

      const secondTeamMember = {
        team: team.name,
        userUniqueId: user1.externalUniqueId,
        roles: 'LA, LWA, LCA, LAA',
        directEmailIdentifier: 'user1',
        outsideDedicatedEmails: 'user1@reva.tech',
        directPhoneIdentifier: '%phone[1]%',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };

      const teamMembersRows = [
        {
          data: firstTeamMember,
          index: 1,
        },
        {
          data: secondTeamMember,
          index: 2,
        },
      ];
      await importTeamMembers(ctx, teamMembersRows);

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);

      expect(dbTeamMembers.length).to.equal(2);

      const dbFirstTeamMember = await getOneWhere(ctx.tenantId, 'TeamMembers', { directEmailIdentifier: firstTeamMember.directEmailIdentifier });
      expect(dbFirstTeamMember.teamId).to.equal(team.id);
      expect(dbFirstTeamMember.mainRoles).to.include('LA');
      expect(dbFirstTeamMember.functionalRoles).to.include('LD');
      expect(isPhoneValid(dbFirstTeamMember.directPhoneIdentifier)).to.equal(true);
      expect(dbFirstTeamMember.voiceMessageId).to.equal(voiceMessage.id);
    });
  });

  describe('when importing a team member without userUniqueId', () => {
    it('the FIELD_REQUIRED error should appear', async () => {
      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: '',
            roles: 'LA, LD',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '%phone[0]%',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];
      const { invalidFields: result } = await importTeamMembers(ctx, teamMemberRow);

      expect(result[0].invalidFields[0].name).to.equal('userUniqueId');
      expect(result[0].invalidFields[0].message).to.equal('FIELD_REQUIRED');

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(0);
    });
  });

  describe('when importing a team member with an area code placeholder and tenant has a corresponding phone available', () => {
    it('will choose the first phone number for the desired pattern', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);
      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: user.externalUniqueId,
            roles: 'LA, LD, LCA, LWA, LAA',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '%phone["area_code_preferences": ["650", "123", "707"]]%',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];

      await importTeamMembers(ctx, teamMemberRow);

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(1);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersBeforeImport.length - 1);

      const usedNumber = tenantFreeNumbersBeforeImport.filter(a => !tenantFreeNumbersAfterImport.some(b => b.phoneNumber === a.phoneNumber))[0];
      const [teamMember] = dbTeamMembers;

      expect(teamMember.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(teamMember.directPhoneIdentifier.substring(1, 4) === 650);
    });
  });

  describe('when importing a team member with one area code placeholder and tenant has no corresponding phone available', () => {
    it('if the area code is invalid no number will be found and it will throw an error', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);
      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: user.externalUniqueId,
            roles: 'LA, LD, LAA, LCA, LWA',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '%phone["area_code_preferences": ["999"]]%',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];
      const { invalidFields: result } = await importTeamMembers(ctx, teamMemberRow);
      expect(result[0].invalidFields[0].name).to.equal('directPhoneIdentifier');

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(0);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersBeforeImport.length);
    });
  });

  describe('when importing a team member with one area code placeholder and tenant has no corresponding phone available', () => {
    it('if the area code is valid it will buy the missing number', async () => {
      const tenantNumbersBeforeImport = await getTenantReservedPhoneNumbers(ctx);

      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: user.externalUniqueId,
            roles: 'LA, LD, LCA, LWA, LAA',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '%phone["area_code_preferences": ["907"]]%',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];
      await importTeamMembers(ctx, teamMemberRow);

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(1);

      const tenantNumbersAfterImport = await getTenantReservedPhoneNumbers(ctx);

      expect(tenantNumbersBeforeImport.length + 1).to.equal(tenantNumbersAfterImport.length);

      const usedNumber = tenantNumbersAfterImport.filter(a => !tenantNumbersBeforeImport.some(b => b.phoneNumber === a.phoneNumber))[0];
      const [teamMember] = dbTeamMembers;

      expect(teamMember.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(teamMember.directPhoneIdentifier.substring(1, 4) === 907);
    });
  });

  describe('when importing twice a team member with a area code placeholder and tenant has a corresponding phone available', () => {
    it('will choose the first phone number for the desired pattern', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);
      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: user.externalUniqueId,
            roles: 'LA, LD, LAA, LCA, LWA',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '%phone["area_code_preferences": ["650", "123", "707"]]%',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];
      await importTeamMembers(ctx, teamMemberRow);

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(1);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersBeforeImport.length - 1);

      const usedNumber = tenantFreeNumbersBeforeImport.filter(a => !tenantFreeNumbersAfterImport.some(b => b.phoneNumber === a.phoneNumber))[0];
      const [teamMember] = dbTeamMembers;

      expect(teamMember.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(teamMember.directPhoneIdentifier.substring(1, 4) === 650);

      await importTeamMembers(ctx, teamMemberRow);

      const dbTeamMembersSecondImport = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembersSecondImport.length).to.equal(1);

      const tenantFreeNumbersAfterImport2 = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersAfterImport2.length);

      const [teamMemberSecondImport] = dbTeamMembersSecondImport;

      expect(teamMemberSecondImport.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(teamMemberSecondImport.directPhoneIdentifier.substring(1, 4) === 650);
    });
  });

  describe('when importing a team member with an area code placeholder with *  and tenant has a corresponding phone available', () => {
    it('will choose the first phone number for the desired pattern', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      const teamMembersRows = await mapSeries(range(tenantFreeNumbersBeforeImport.length - 1), async i => {
        const newUser = await createAUser();
        return {
          data: {
            team: team.name,
            userUniqueId: newUser.externalUniqueId,
            roles: 'LA, LCA, LWA, LAA',
            directEmailIdentifier: `test${i}DN.email`,
            outsideDedicatedEmails: `user${i}@reva.tech `,
            directPhoneIdentifier: `%phone[${i}]%`,
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: i,
        };
      });

      teamMembersRows[0].data.roles = 'LD';
      await importTeamMembers(ctx, teamMembersRows);

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(teamMembersRows.length);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(1);

      const unusedNumber = tenantFreeNumbersAfterImport[0];

      const teamMemberRowSecondTime = [
        {
          data: {
            team: team.name,
            userUniqueId: user.externalUniqueId,
            roles: 'LA, LCA, LAA, LWA',
            directEmailIdentifier: 'test.email',
            outsideDedicatedEmails: '',
            directPhoneIdentifier: '%phone["area_code_preferences": [*]]%',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];

      await importTeamMembers(ctx, teamMemberRowSecondTime);

      const dbTeamMembers2 = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers2.length).to.equal(tenantFreeNumbersBeforeImport.length);
      const tenantFreeNumbersAfterImport2 = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport2.length).to.equal(0);

      const addedTeamMember2 = dbTeamMembers2.find(tm => tm.directEmailIdentifier === 'test.email');

      expect(addedTeamMember2.directPhoneIdentifier).to.equal(unusedNumber.phoneNumber);
    });
  });
  describe('when importing a set of team members', () => {
    it('will assign phone numbers based on rankings', async () => {
      const tenantReservedPhoneNumbers = [
        { phoneNumber: '16504466743' },
        { phoneNumber: '14083379248' },
        { phoneNumber: '12093258716' },
        { phoneNumber: '15093258699' },
        { phoneNumber: '19513964504' },
      ];

      await updateTenantPhoneNumbers(ctx, tenant, tenantReservedPhoneNumbers);
      const directPhoneIdentifierArray = [
        '16504466743',
        '',
        '%phone[1]%',
        '%phone["area_code_preferences": [*]]%',
        '%phone["area_code_preferences": ["509", *]]%',
        '%phone["area_code_preferences": ["209", "406"]]%',
        '%phone["area_code_preferences": ["209", "406"]]%',
        '%phone["area_code_preferences": [*]]%',
      ];
      const teamMembersRows = await mapSeries(range(8), async i => {
        const newUser = await createAUser();
        return {
          data: {
            team: team.name,
            userUniqueId: newUser.externalUniqueId,
            roles: 'LA, LCA, LWA, LAA',
            directEmailIdentifier: `test${i}DN.email`,
            outsideDedicatedEmails: `user${i}@reva.tech `,
            directPhoneIdentifier: directPhoneIdentifierArray[i],
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: i,
        };
      });

      teamMembersRows[0].data.roles = 'LD';
      await importTeamMembers(ctx, teamMembersRows);
      const dbTeamMembers = await getTeamMembersToExport(ctx);

      expect(dbTeamMembers.length).to.equal(8);

      const tenantNumbersAfterImport = await getTenantReservedPhoneNumbers(ctx);

      expect(tenantNumbersAfterImport.length).to.equal(7);
      expect(tenantNumbersAfterImport.filter(t => !t.isUsed).length).to.equal(0);

      const boughtNumbers = tenantNumbersAfterImport.filter(t => !tenantReservedPhoneNumbers.map(tb => tb.phoneNumber).includes(t.phoneNumber));

      expect(boughtNumbers.length).to.equal(2);

      expect(dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[0].data.userUniqueId).directPhoneIdentifier).to.equal(
        '16504466743',
      );
      expect(dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[1].data.userUniqueId).directPhoneIdentifier).to.equal('');
      expect(dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[2].data.userUniqueId).directPhoneIdentifier).to.equal(
        '14083379248',
      );
      expect(dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[5].data.userUniqueId).directPhoneIdentifier).to.equal(
        '12093258716',
      );

      expect(dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[4].data.userUniqueId).directPhoneIdentifier).to.equal(
        '15093258699',
      );
      expect(dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[3].data.userUniqueId).directPhoneIdentifier).to.equal(
        '19513964504',
      );

      expect(
        boughtNumbers.some(
          bn =>
            bn.phoneNumber === dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[6].data.userUniqueId).directPhoneIdentifier,
        ),
      ).to.be.true;
      expect(
        boughtNumbers.some(
          bn =>
            bn.phoneNumber === dbTeamMembers.find(p => p.team === team.name && p.userUniqueId === teamMembersRows[7].data.userUniqueId).directPhoneIdentifier,
        ),
      ).to.be.true;
    });
  });

  describe('importing an employee with external calendar account', () => {
    it('will make the requests to cronofy for account delegate access after team members are imported', async () => {
      const employeeData = {
        userUniqueId: '123',
        registrationEmail: 'test@revatech.com',
        fullName: 'Bill Smith',
        businessTitle: 'Leasing Consultant',
        preferredName: 'Bill',
        employmentType: 'permanent',
        calendarAccount: 'bill@revatech.com',
      };

      const employeeRow = [
        {
          data: employeeData,
          index: 1,
        },
      ];

      await toggleExtCalendarFeature(true);

      const requestDelegatedAccess = sinon.spy();
      setCalendarOps({ requestDelegatedAccess });

      await importEmployees(ctx, employeeRow);

      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: '123',
            roles: 'LA, LD, LAA, LCA, LWA',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];
      await importTeamMembers(ctx, teamMemberRow);

      const { task: extCalendarMessage } = await setupQueueToWaitFor([msg => msg.userExternalUniqueId === employeeData.userUniqueId], CALENDAR_TOPICS);

      await extCalendarMessage;

      const {
        metadata: { externalCalendars },
      } = await getTenantData(ctx);

      const { delegatedAccessUrl } = await getCronofyConfigs(ctx);
      const { id: userId } = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId: employeeData.userUniqueId });

      expect(requestDelegatedAccess).to.have.been.calledOnce;
      expect(requestDelegatedAccess).to.have.been.calledWith({
        accessToken: externalCalendars.access_token,
        emailAddress: employeeData.calendarAccount,
        callbackUrl: delegatedAccessUrl,
        state: `${CalendarTargetType.USER}:${userId}`,
      });

      await toggleExtCalendarFeature(false);
    });
  });
  describe('importing an employee with removed external calendar account', () => {
    it(`will make the requests to cronofy to remove events from reva calendar, close notification channel and
    revoke account authorization and will remove user personal events from database table`, async () => {
      const dbUserWithCalendar = await createAUser({
        externalCalendars: {
          calendarAccount: 'bill@revatech.com',
          revaCalendarId: '123321',
          notificationChannels: [{ channel: { channel_id: '1' } }],
          refresh_token: '1',
          access_token: 'at1',
        },
      });
      const { id: userId, externalUniqueId } = dbUserWithCalendar;

      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: externalUniqueId,
            roles: 'LA, LD, LAA, LCA, LWA',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: false,
          },
          index: 1,
        },
      ];

      const eventStartDate = '2018-01-01';
      await createUserPersonalEvent({
        userId,
        startDate: eventStartDate,
        endDate: '2018-02-01',
      });

      const userEvents = await getUserEvents(ctx, userId, eventStartDate);
      expect(userEvents.length).to.be.equal(1);

      await toggleExtCalendarFeature(true);

      const removeAllEvents = sinon.spy();
      const closeNotificationChannel = sinon.spy();
      const revokeAuthorization = sinon.spy();
      setCalendarOps({ removeAllEvents, closeNotificationChannel, revokeAuthorization });

      const { task: extCalendarMessage } = await setupQueueToWaitFor([msg => msg.userExternalUniqueId === externalUniqueId], CALENDAR_TOPICS);

      await importTeamMembers(ctx, teamMemberRow);

      await updateUser(ctx, userId, {
        externalCalendars: {
          calendarAccount: '',
          revaCalendarId: '123321',
          notificationChannels: [{ channel: { channel_id: '1' } }],
          refresh_token: '1',
          access_token: 'at1',
        },
      });

      await importTeamMembers(ctx, teamMemberRow);

      await extCalendarMessage;

      const { revaCalendarId, access_token: accessToken, notificationChannels, refresh_token: refreshToken } = dbUserWithCalendar.externalCalendars;

      expect(removeAllEvents).to.have.been.calledOnce;
      expect(removeAllEvents).to.have.been.calledWith({ calendarIds: [revaCalendarId], accessToken });

      expect(closeNotificationChannel).to.have.been.calledOnce;
      expect(closeNotificationChannel).to.have.been.calledWith({ channelId: notificationChannels[0].channel.channel_id, accessToken });

      const { clientId, clientSecret } = await getCronofyConfigs(ctx);

      expect(revokeAuthorization).to.have.been.calledOnce;
      expect(revokeAuthorization).to.have.been.calledWith({ clientId, clientSecret, refreshToken });

      const updatedUserEvents = await getUserEvents(ctx, userId, eventStartDate);
      expect(updatedUserEvents.length).to.be.equal(0);
      const updatedUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId });
      expect(updatedUser.externalCalendars.calendarAccount).to.be.undefined;

      await toggleExtCalendarFeature(false);
    });
  });

  describe('importing an deactivated team member that had a calendar account', () => {
    it(`will make the requests to cronofy to remove events from reva calendar, close notification channel and
    revoke account authorization and will remove user personal events from database table`, async () => {
      const dbUserWithCalendar = await createAUser({
        externalCalendars: {
          calendarAccount: 'bill@revatech.com',
          revaCalendarId: '123321',
          notificationChannels: [{ channel: { channel_id: '1' } }],
          refresh_token: '1',
          access_token: 'at1',
        },
      });
      const { id: userId, externalUniqueId } = dbUserWithCalendar;

      await createATeamMember({ teamId: team.id, userId, inactive: false });

      const teamMemberRow = [
        {
          data: {
            team: team.name,
            userUniqueId: externalUniqueId,
            roles: 'LA, LD, LAA, LCA, LWA',
            directEmailIdentifier: 'user',
            outsideDedicatedEmails: 'user@reva.tech',
            directPhoneIdentifier: '',
            voiceMessage: voiceMessage.name,
            externalId: '',
            inactiveFlag: true,
          },
          index: 1,
        },
      ];

      const eventStartDate = '2018-01-01';
      await createUserPersonalEvent({
        userId,
        startDate: eventStartDate,
        endDate: '2018-02-01',
      });

      const userEvents = await getUserEvents(ctx, userId, eventStartDate);
      expect(userEvents.length).to.be.equal(1);

      await toggleExtCalendarFeature(true);

      const removeAllEvents = sinon.spy();
      const closeNotificationChannel = sinon.spy();
      const revokeAuthorization = sinon.spy();
      setCalendarOps({ removeAllEvents, closeNotificationChannel, revokeAuthorization });

      const { task: extCalendarMessage } = await setupQueueToWaitFor([msg => msg.userExternalUniqueId === externalUniqueId], CALENDAR_TOPICS);

      await importTeamMembers(ctx, teamMemberRow);

      await extCalendarMessage;

      const { revaCalendarId, access_token: accessToken, notificationChannels, refresh_token: refreshToken } = dbUserWithCalendar.externalCalendars;

      expect(removeAllEvents).to.have.been.calledOnce;
      expect(removeAllEvents).to.have.been.calledWith({ calendarIds: [revaCalendarId], accessToken });

      expect(closeNotificationChannel).to.have.been.calledOnce;
      expect(closeNotificationChannel).to.have.been.calledWith({ channelId: notificationChannels[0].channel.channel_id, accessToken });

      const { clientId, clientSecret } = await getCronofyConfigs(ctx);

      expect(revokeAuthorization).to.have.been.calledOnce;
      expect(revokeAuthorization).to.have.been.calledWith({ clientId, clientSecret, refreshToken });

      const updatedUserEvents = await getUserEvents(ctx, userId, eventStartDate);
      expect(updatedUserEvents.length).to.be.equal(0);
      const updatedUser = await getOneWhere(ctx.tenantId, 'Users', { externalUniqueId });
      expect(updatedUser.externalCalendars.calendarAccount).to.be.undefined;

      await toggleExtCalendarFeature(false);
    });
  });

  describe('when importing new team members', () => {
    it('will filter the inactiveUsersIds and after disconnected them', async () => {
      const team2 = await createATeam({
        name: 'testTeam2',
        module: 'leasing',
        email: 'leasing_email2',
        phone: '12345678923',
      });

      const team3 = await createATeam({
        name: 'testTeam3',
        module: 'leasing',
        email: 'leasing_email3',
        phone: '16503381460',
      });

      const user2 = await createAUser();
      const user3 = await createAUser();

      const teamMember1 = {
        team: team.name,
        userUniqueId: user.externalUniqueId,
        roles: 'LA, LWA',
        directEmailIdentifier: 'user',
        outsideDedicatedEmails: 'user@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: true,
      };

      const teamMember2 = {
        team: team.name,
        userUniqueId: user1.externalUniqueId,
        roles: 'LA, LWA, LCA, LAA',
        directEmailIdentifier: 'user1',
        outsideDedicatedEmails: 'user1@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: true,
      };

      const teamMember3 = {
        team: team.name,
        userUniqueId: user2.externalUniqueId,
        roles: 'LA, LWA, LAA',
        directEmailIdentifier: 'user2',
        outsideDedicatedEmails: 'user2@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };

      const teamMember4 = {
        team: team2.name,
        userUniqueId: user.externalUniqueId,
        roles: 'LA, LWA, LCA, LAA',
        directEmailIdentifier: 'user3',
        outsideDedicatedEmails: 'user3@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };

      const teamMember5 = {
        team: team2.name,
        userUniqueId: user1.externalUniqueId,
        roles: 'LA, LWA, LAA',
        directEmailIdentifier: 'user4',
        outsideDedicatedEmails: 'user4@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };

      const teamMember6 = {
        team: team3.name,
        userUniqueId: user.externalUniqueId,
        roles: 'LA, LWA, LAA',
        directEmailIdentifier: 'user5',
        outsideDedicatedEmails: 'user5@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };

      const teamMember7 = {
        team: team3.name,
        userUniqueId: user3.externalUniqueId,
        roles: 'LA, LWA, LAA',
        directEmailIdentifier: 'user6',
        outsideDedicatedEmails: 'user6@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };

      const teamMembersRows = [
        {
          data: teamMember1,
          index: 1,
        },
        {
          data: teamMember2,
          index: 2,
        },
        {
          data: teamMember3,
          index: 3,
        },
        {
          data: teamMember4,
          index: 4,
        },
        {
          data: teamMember5,
          index: 5,
        },
        {
          data: teamMember6,
          index: 6,
        },
        {
          data: teamMember7,
          index: 7,
        },
      ];

      await importTeamMembers(ctx, teamMembersRows);

      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(7);

      teamMember3.inactiveFlag = true;
      teamMember4.inactiveFlag = true;
      teamMember5.inactiveFlag = true;

      const { inactiveUserIds } = await importTeamMembers(ctx, teamMembersRows);
      expect(inactiveUserIds.length).to.equal(2);
    });

    it('we will filter the userIds and if none of them are being marked as inactive then we will make sure that no agent is being logged out', async () => {
      const team2 = await createATeam({
        name: 'testTeam2',
        module: 'leasing',
        email: 'leasing_email2',
        phone: '12345678923',
      });
      const user2 = await createAUser();
      const teamMember1 = {
        team: team.name,
        userUniqueId: user.externalUniqueId,
        roles: 'LA, LWA',
        directEmailIdentifier: 'user',
        outsideDedicatedEmails: 'user@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };
      const teamMember2 = {
        team: team.name,
        userUniqueId: user1.externalUniqueId,
        roles: 'LA, LWA, LCA, LAA',
        directEmailIdentifier: 'user1',
        outsideDedicatedEmails: 'user1@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };
      const teamMember3 = {
        team: team2.name,
        userUniqueId: user2.externalUniqueId,
        roles: 'LA, LWA, LAA',
        directEmailIdentifier: 'user2',
        outsideDedicatedEmails: 'user2@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };
      const teamMember4 = {
        team: team2.name,
        userUniqueId: user.externalUniqueId,
        roles: 'LA, LWA, LCA, LAA',
        directEmailIdentifier: 'user3',
        outsideDedicatedEmails: 'user3@reva.tech',
        directPhoneIdentifier: '',
        voiceMessage: voiceMessage.name,
        externalId: '',
        inactiveFlag: false,
      };
      const teamMembersRows = [
        {
          data: teamMember1,
          index: 1,
        },
        {
          data: teamMember2,
          index: 2,
        },
        {
          data: teamMember3,
          index: 3,
        },
        {
          data: teamMember4,
          index: 4,
        },
      ];
      await importTeamMembers(ctx, teamMembersRows);
      const dbTeamMembers = await getTeamMembers(ctx.tenantId);
      expect(dbTeamMembers.length).to.equal(4);
      const { inactiveUserIds } = await importTeamMembers(ctx, teamMembersRows);
      expect(inactiveUserIds.length).to.equal(0);
    });
  });
});
