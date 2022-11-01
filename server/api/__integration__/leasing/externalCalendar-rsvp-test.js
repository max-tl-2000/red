/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import chai from 'chai';
import newId from 'uuid/v4';

import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import config from '../../../config';
import { cronofyRsvpStatusTypes } from '../../../services/appointments';
import { tenant as ctx } from '../../../testUtils/setupTestGlobalContext';
import { createAParty, createAPartyMember, createAUser, createATeam, createAProperty, createAnAppointment } from '../../../testUtils/repoHelper';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { now } from '../../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { DALTypes } from '../../../../common/enums/DALTypes';

const expect = chai.expect;
const assert = chai.assert;

const setUp = async () => {
  const property = await createAProperty({});
  const party = await createAParty();
  const { id: userId } = await createAUser();
  const { id: partyMemberId } = await createAPartyMember(party.id, {
    fullName: 'John Doe',
    contactInfo: enhance([{ type: 'email', value: 'john.doe@test.com', id: newId() }]),
  });
  const { id: teamId } = await createATeam();

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

  return { appointment, userId };
};

const getRequestBody = (status, email, appointmentId) => ({
  notification: { type: 'smart_invite' },
  smart_invite: {
    smart_invite_id: appointmentId,
    reply: { email, status },
  },
});

describe('when a party member is interacting with a calendar invite through RSVP buttons', () => {
  it('should update the appointment metadata with incoming rsvp response status', async () => {
    const externalCalendarRsvpStatusUrl = `/webhooks/externalCalendarRsvpStatus?api-token=${config.tokens.api}`;
    const { appointment, userId } = await setUp();
    const {
      metadata: { partyMembers },
    } = appointment;
    const acceptanceReply = { email: 'john.doe@test.com', status: cronofyRsvpStatusTypes.ACCEPTED };
    const tentativeReply = { email: 'john.doe@test.com', status: cronofyRsvpStatusTypes.TENTATIVE };
    const declineReply = { email: 'john.doe@test.com', status: cronofyRsvpStatusTypes.DECLINED };

    // Update appointment metadata, add the rsvpStatuses array with first RSVP response.
    const {
      body: {
        state,
        metadata: { rsvpStatuses: acceptedRsvpStatus },
      },
    } = await request(app)
      .post(externalCalendarRsvpStatusUrl)
      .set(getAuthHeader(ctx.id, userId))
      .send(getRequestBody(acceptanceReply.status, acceptanceReply.email, appointment.id))
      .expect(200);

    assert(acceptedRsvpStatus, 'rsvpStatuses has been defined');
    expect(acceptedRsvpStatus).to.be.eql([{ ...acceptanceReply, partyMemberId: partyMembers[0] }]);
    expect(state).to.be.equal(DALTypes.TaskStates.ACTIVE);

    // Update existing RSVP status
    const {
      body: {
        state: AppStateOnUpdate,
        metadata: { rsvpStatuses: tentativeRsvpStatus },
      },
    } = await request(app)
      .post(externalCalendarRsvpStatusUrl)
      .set(getAuthHeader(ctx.id, userId))
      .send(getRequestBody(tentativeReply.status, tentativeReply.email, appointment.id))
      .expect(200);

    expect(tentativeRsvpStatus).to.be.eql([{ ...tentativeReply, partyMemberId: partyMembers[0] }]);
    expect(AppStateOnUpdate).to.be.equal(DALTypes.TaskStates.ACTIVE);

    // Update existing RSVP status and cancel the appointment on decline
    const {
      body: {
        state: AppStateOnDecline,
        metadata: { rsvpStatuses: declineRsvpStatus },
      },
    } = await request(app)
      .post(externalCalendarRsvpStatusUrl)
      .set(getAuthHeader(ctx.id, userId))
      .send(getRequestBody(declineReply.status, declineReply.email, appointment.id))
      .expect(200);

    expect(declineRsvpStatus).to.be.eql([{ ...declineReply, partyMemberId: partyMembers[0] }]);
    expect(AppStateOnDecline).to.be.equal(DALTypes.TaskStates.CANCELED);
  });
});
