/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';
import {
  createAParty,
  createAPartyMember,
  createAUser,
  createATeam,
  createATeamMember,
  createAProperty,
  createAnAppointment,
  createATeamPropertyProgram,
  toggleExtCalendarFeature,
  toggleSendIcsAttachmentFeature,
} from '../../testUtils/repoHelper';

import { tenant as ctx } from '../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../common/enums/DALTypes';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { LA_TIMEZONE } from '../../../common/date-constants';
import { now } from '../../../common/helpers/moment-utils';
import { setSendCommunicationFunc, resetSendCommunicationFunc } from '../mjmlEmails/appointmentEmails';
import { sendCommsOnCreateAppointment, sendCommsOnUpdateAppointment, sendCommsOnCancelAppointment } from '../appointments';
import { setCalendarOps } from '../externalCalendars/providerApiOperations';
import { getCancelInviteOptions, getCreateInviteOptions } from '../externalCalendars/cronofyService';
import { getCronofyConfigs } from '../../helpers/tenantContextConfigs';
import { getAppointmentAddress } from '../helpers/calendarHelpers';
import { getTimezoneForParty } from '../../dal/partyRepo';
import { getUserFullNameById } from '../../dal/usersRepo';
import { getPropertyById } from '../../dal/propertyRepo';

chai.use(sinonChai);
const expect = chai.expect;

const getAppointmentData = () => ({
  emails: {
    membersToSendEmailConfirmation: ['john.doe@test.com'],
    membersToSendEmailCancelation: ['removed.doe@test.com'],
  },
  phones: { membersToSendSMSConfirmation: [] },
  emailPropertyTemplates: {
    appointmentCreatedTemplateName: 'appointment-event-created',
    appointmentUpdatedTemplateName: 'appointment-event-updated',
    appointmentCancelledTemplateName: 'appointment-event-cancelled',
  },
});

const setUp = async () => {
  const property = await createAProperty({});
  const party = await createAParty();
  const { id: userId } = await createAUser();
  const { id: partyMemberId } = await createAPartyMember(party.id, {
    fullName: 'John Doe',
    contactInfo: enhance([{ type: 'email', value: 'john.doe@test.com', id: newId() }]),
  });
  const { id: teamId } = await createATeam();
  const { clientSecret, externalCalendarRsvpNotificationUrl } = await getCronofyConfigs(ctx);

  const tomorrow = now({ timezone: LA_TIMEZONE }).startOf('day').add(1, 'days');

  const appointment = await createAnAppointment({
    partyId: party.id,
    partyMembers: [partyMemberId],
    salesPersonId: userId,
    startDate: tomorrow.clone().add(8, 'hours'),
    endDate: tomorrow.clone().add(9, 'hours'),
    metadata: {
      teamId,
      selectedPropertyId: property.id,
    },
    createdBy: userId,
  });

  const appointmentData = { appointmentId: appointment.id, ...getAppointmentData() };
  return { appointmentData, appointment, clientSecret, externalCalendarRsvpNotificationUrl };
};

describe('send email for appointment', () => {
  // eslint-disable-next-line
  [
    [sendCommsOnCreateAppointment, 'create'],
    [sendCommsOnUpdateAppointment, 'update'],
    [sendCommsOnCancelAppointment, 'cancel'],
  ].forEach(([appointmentSendFunc, action]) =>
    describe(`when sending mail for ${action} and the appointment has modified_by agent id`, () => {
      afterEach(() => resetSendCommunicationFunc());
      const createAppointmentData = async ({ isSelfServiceAppointment = false } = {}) => {
        const { id: modifiedById } = await createAUser();
        const { id: assignedAgentId } = await createAUser();
        const { id: teamId } = await createATeam();
        await createATeamMember({ teamId, userId: modifiedById });
        await createATeamMember({ teamId, userId: assignedAgentId });

        const property = await createAProperty({});
        await createATeamPropertyProgram({
          teamId,
          propertyId: property.id,
          commDirection: DALTypes.CommunicationDirection.OUT,
          displayEmail: 'test',
        });
        const { id: partyId } = await createAParty({
          teams: [teamId],
          ownerTeam: teamId,
          assignedPropertyId: property.id,
        });
        const { id: partyMemberId } = await createAPartyMember(partyId, {
          fullName: 'John Doe',
          contactInfo: enhance([{ type: 'email', value: 'john.doe@test.com', id: newId() }]),
        });

        await createAPartyMember(partyId, {
          fullName: 'Removed Doe',
          contactInfo: enhance([{ type: 'email', value: 'removed.doe@test.com', id: newId() }]),
        });

        const tomorrow = now({ timezone: LA_TIMEZONE }).startOf('day').add(1, 'days');

        const selfServiceAppointment = isSelfServiceAppointment ? { appointmentCreatedFrom: DALTypes.AppointmentCreatedFrom.SELF_SERVICE } : {};
        const createdBy = isSelfServiceAppointment ? {} : { createdBy: modifiedById };
        const { id: appointmentId } = await createAnAppointment({
          partyId,
          partyMembers: [partyMemberId],
          salesPersonId: assignedAgentId,
          startDate: tomorrow.clone().add(8, 'hours'),
          endDate: tomorrow.clone().add(9, 'hours'),
          metadata: {
            teamId,
            selectedPropertyId: property.id,
            ...selfServiceAppointment,
          },
          ...createdBy,
        });

        const appointmentData = { appointmentId, ...getAppointmentData() };

        return { appointmentData, modifiedById, assignedAgentId };
      };

      it('should be the author of the appointment email', async () => {
        const { appointmentData, modifiedById } = await createAppointmentData();

        let senderUser;
        const sendMailFunc = sinon.spy(({ sender }) => (senderUser = sender));
        setSendCommunicationFunc(sendMailFunc);

        await appointmentSendFunc(ctx, appointmentData);
        expect(senderUser.id).to.equal(modifiedById);
      });

      describe('when the appointment is created from self service', () => {
        it('the assigned agent should be the author of the appointment email', async () => {
          const { appointmentData, assignedAgentId } = await createAppointmentData({ isSelfServiceAppointment: true });

          let senderUser;
          const sendMailFunc = sinon.spy(({ sender }) => (senderUser = sender));
          setSendCommunicationFunc(sendMailFunc);

          await appointmentSendFunc(ctx, appointmentData);
          expect(senderUser.id).to.equal(assignedAgentId);
        });
      });
    }),
  );
});

describe('generate an ICS calendar invite', () => {
  describe('when is not CalendarIntegrationEnabled', () => {
    it('should not call Cronofy function createSmartInvite', async () => {
      await toggleExtCalendarFeature(false);

      const createSmartInvite = sinon.spy(() => ({ attachments: { icalendar: 'ics-content' } }));
      setCalendarOps({ createSmartInvite });

      const { appointmentData } = await setUp();
      setSendCommunicationFunc(sinon.spy(() => {}));

      await sendCommsOnCreateAppointment(ctx, appointmentData);
      expect(createSmartInvite).to.not.have.been.called;
    });
  });

  describe('when isCalendarIntegrationEnabled', () => {
    it('should create/update/cancel an invite', async () => {
      const icsAttachmentData = { attachments: { icalendar: 'ics-content' } };
      const createSmartInvite = sinon.spy(() => icsAttachmentData);
      const cancelSmartInvite = sinon.spy(() => icsAttachmentData);
      const { appointmentData, appointment, clientSecret, externalCalendarRsvpNotificationUrl } = await setUp();
      const { displayName } = await getPropertyById(ctx, appointment.metadata.selectedPropertyId);

      const createInviteOptions = getCreateInviteOptions({
        appointment,
        clientSecret,
        externalCalendarRsvpNotificationUrl,
        recipientsEmails: ['john.doe@test.com'],
        summary: `Property tour on ${displayName}`,
        description: '',
        metadata: appointment.metadata,
        partyTimeZone: await getTimezoneForParty(ctx, appointment.partyId),
        propertyAddress: await getAppointmentAddress(ctx, appointment),
        organizer: await getUserFullNameById(ctx, appointment.userIds[0]),
      });
      const cancelInviteOptions = getCancelInviteOptions({
        appointment,
        recipientsEmails: ['john.doe@test.com'],
        clientSecret,
        externalCalendarRsvpNotificationUrl,
      });

      await toggleExtCalendarFeature(true);

      setSendCommunicationFunc(sinon.spy(() => {}));
      setCalendarOps({ createSmartInvite, cancelSmartInvite });

      // createSmartInvite should not be called when tenant.settings.feature.enableIcsAttachment = false
      await toggleSendIcsAttachmentFeature(false);
      await sendCommsOnCreateAppointment(ctx, appointmentData);
      expect(createSmartInvite).to.not.have.been.called;

      // set tenant.settings.feature.enableIcsAttachment = true
      await toggleSendIcsAttachmentFeature(true);

      // Test create smart invite
      await sendCommsOnCreateAppointment(ctx, appointmentData);
      expect(createSmartInvite).to.have.been.calledOnce;
      expect(createSmartInvite).to.have.been.calledWith(createInviteOptions);
      createSmartInvite.reset();

      // Test update smart invite
      await sendCommsOnUpdateAppointment(ctx, appointmentData);
      expect(createSmartInvite).to.have.been.calledOnce;
      expect(createSmartInvite).to.have.been.calledWith(createInviteOptions);

      // Test delete smart invite
      await sendCommsOnCancelAppointment(ctx, appointmentData);
      expect(cancelSmartInvite).to.have.been.calledOnce;
      expect(cancelSmartInvite).to.have.been.calledWith(cancelInviteOptions);

      resetSendCommunicationFunc();
      await toggleExtCalendarFeature(false);
    });
  });
});
