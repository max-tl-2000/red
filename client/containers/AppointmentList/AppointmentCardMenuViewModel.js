/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { formatAppointmentTitleForAppointmentCard } from '../../helpers/appointments';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { toMoment, now } from '../../../common/helpers/moment-utils';

export class AppointmentCardMenuViewModel {
  constructor(appointment, timezone) {
    this.appointment = appointment;
    this.timezone = timezone;
  }

  get appointmentPartyMembers() {
    return this.appointment.partyMembers || [];
  }

  get unitsAsText() {
    return this.appointment.metadata.inventories.length ? this.appointment.metadata.inventories.map(unit => unit.fullQualifiedName).join(', ') : '';
  }

  get tourType() {
    return this.metadata.tourType;
  }

  get title() {
    const { appointment, timezone } = this;
    return formatAppointmentTitleForAppointmentCard(appointment, timezone);
  }

  get notes() {
    return this.metadata.note;
  }

  get closingNotes() {
    return this.metadata.closingNote;
  }

  get feedback() {
    return this.metadata.feedback;
  }

  get metadata() {
    return this.appointment.metadata || {};
  }

  get isRescheduled() {
    return this.appointment.metadata.rescheduled;
  }

  get partyMembersSource() {
    return this.appointment.partyMembers.map(({ id, person }) => ({
      id,
      text: getDisplayName(person),
    }));
  }

  get appointmentResult() {
    return this.metadata.appointmentResult;
  }

  get completed() {
    return this.appointment.state === DALTypes.TaskStates.COMPLETED;
  }

  get canceled() {
    return this.appointment.state === DALTypes.TaskStates.CANCELED;
  }

  get editable() {
    return this.appointment.state === DALTypes.TaskStates.ACTIVE;
  }

  get isCancelVisible() {
    return this.appointment.state === DALTypes.TaskStates.ACTIVE;
  }

  get isMarkAsNoShowVisible() {
    return this.appointment.state === DALTypes.TaskStates.ACTIVE;
  }

  get isMarkAsCompleteVisible() {
    return this.appointment.state === DALTypes.TaskStates.ACTIVE;
  }

  get isUnMarkAsCompleteVisible() {
    return this.appointment.state !== DALTypes.TaskStates.ACTIVE;
  }

  get isMarkAsCompleteEnabled() {
    const { appointment, timezone } = this;
    return toMoment(appointment.metadata.startDate, { timezone }) < now({ timezone });
  }

  get isMarkAsNoShowEnabled() {
    const { appointment, timezone } = this;
    return toMoment(appointment.metadata.startDate, { timezone }) < now({ timezone });
  }

  getAppointmentId() {
    return this.appointment.id;
  }

  getAppointment() {
    return this.appointment;
  }

  getPartyMembers() {
    return this.appointment.partyMembers;
  }
}
