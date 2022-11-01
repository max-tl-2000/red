/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import sortBy from 'lodash/sortBy';
import { MsgBox, Typography as T } from 'components';
import { cf } from './AssignPartyAppointmentConflictDialog.scss';
import { formatAppointmentTitleForAppointmentCard } from '../../helpers/appointments.js';

import { toMoment } from '../../../common/helpers/moment-utils';

export default class AssignPartyAppointmentConflictDialog extends Component {
  handleOnOverbookRequest = () => {
    const { onOverbookRequest, task, sendConfirmationMail } = this.props;
    if (onOverbookRequest) {
      if (task) onOverbookRequest(task, sendConfirmationMail, { checkConflictingAppointments: false });
      else onOverbookRequest({ checkConflictingAppointments: false });
    }
  };

  renderAppointments = appointments => {
    const sortedAppointments = sortBy(appointments, appointment => -toMoment(appointment.metadata.startDate).utc());

    return sortedAppointments.map(appointment => (
      <T.Text key={appointment.id}>{formatAppointmentTitleForAppointmentCard(appointment, this.props.timezone)}</T.Text>
    ));
  };

  renderContentForUser = (selectedPartyAssignee, appointments, conflictingAppointmentIds) => {
    const conflictingAppointments = conflictingAppointmentIds.map(apptId => appointments.find(a => a.id === apptId));

    return (
      <div>
        <T.Text>
          {t('APPOINTMENTS_CONFLICT_MESSAGE', {
            agentName: selectedPartyAssignee.fullName,
          })}
        </T.Text>
        <div className={cf('appointments')}>{this.renderAppointments(conflictingAppointments)}</div>
        <T.Text>{t('OVERBOOK_CONFIRMATION')}</T.Text>
      </div>
    );
  };

  renderContentForTeam = (selectedPartyAssignee, appointments, partyOwnerId) => {
    const partyOwnerAppointments = appointments.filter(item => item.userIds.includes(partyOwnerId));

    return (
      <div>
        <T.Text>
          {t('NO_ONE_FREE_TO_TAKE_APPOINTMENTS', {
            teamName: selectedPartyAssignee.fullName,
          })}
        </T.Text>
        <div className={cf('appointments')}>{this.renderAppointments(partyOwnerAppointments.toArray())}</div>
        <T.Text>{t('PARTY_CANNOT_BE_ASSIGNED_TO_TEAM')}</T.Text>
      </div>
    );
  };

  renderContent = (selectedPartyAssignee, appointments, conflictingAppointmentIds, partyOwnerId) => (
    <div>
      <div className={cf('dialogTitle')}>
        <T.Title>Appointment conflict</T.Title>
      </div>
      <div className={cf('dialogContent')}>
        {selectedPartyAssignee.isTeam
          ? this.renderContentForTeam(selectedPartyAssignee, appointments, partyOwnerId)
          : this.renderContentForUser(selectedPartyAssignee, appointments, conflictingAppointmentIds)}
      </div>
    </div>
  );

  render() {
    const { open, onClose, selectedPartyAssignee, appointments, conflictingAppointmentIds, partyOwnerId } = this.props;

    if (selectedPartyAssignee.isTeam) {
      return (
        <MsgBox
          open={open}
          content={this.renderContent(selectedPartyAssignee, appointments, conflictingAppointmentIds, partyOwnerId)}
          onClose={onClose}
          lblOK={t('OK_GOT_IT')}
          hideCancelButton
        />
      );
    }

    return (
      <MsgBox
        open={open}
        content={this.renderContent(selectedPartyAssignee, appointments, conflictingAppointmentIds, partyOwnerId)}
        onClose={onClose}
        onOKClick={this.handleOnOverbookRequest}
        lblOK={t('OVERBOOK')}
        lblCancel={t('CANCEL')}
      />
    );
  }
}
