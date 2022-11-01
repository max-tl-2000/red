/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { isString } from 'helpers/type-of';
import { cf } from './AppointmentCard.scss';
import AppointmentCardMenu from './AppointmentCardMenu';
import { AppointmentCardMenuViewModel } from './AppointmentCardMenuViewModel';
import GuestList from '../../custom-components/GuestList/GuestList';
import { isSelfServiceAppointment } from '../../../common/helpers/tasks';
import { getTourTypesForAppointmentCard } from '../../helpers/appointments';
import { getClosingNote, isTaskDeclinedViaExtCalendar, getFeedbackForIcsRsvpDecline } from '../../helpers/taskUtils';

export default class AppointmentCard extends Component {
  static propTypes = {
    appointment: PropTypes.object.isRequired,
    editAppointment: PropTypes.func.isRequired,
    partyMembers: PropTypes.object,
    onClickMenuAction: PropTypes.func.isRequired,
    timezone: PropTypes.string,
  };

  handleEdit = () => {
    const viewModel = this.appointmentViewModel;
    if (viewModel.completed) return;
    this.props.editAppointment && this.props.editAppointment(viewModel.appointment);
  };

  renderClosingNote = () => {
    const { appointment: task } = this.props;
    const closingNote = getClosingNote(task, task.partyMembers);

    return (
      closingNote?.message && (
        <T.Text style={{ marginTop: '.5rem' }}>
          <T.Text bold inline>
            {`${t('CLOSING_NOTES')}: `}
          </T.Text>
          <T.Text inline>{closingNote.label}</T.Text>
          <T.Text inline>{closingNote.message}</T.Text>
        </T.Text>
      )
    );
  };

  renderDeclinedBy = () => {
    const { appointment: task } = this.props;
    const declinedBy = getFeedbackForIcsRsvpDecline(task, task.partyMembers);
    const isAppointmentDeclined = isTaskDeclinedViaExtCalendar(task);

    return (
      isAppointmentDeclined && (
        <T.Text style={{ marginTop: '.5rem' }}>
          <T.Text bold inline>
            {`${t('DECLINED')}: `}
          </T.Text>
          <T.Text inline>{declinedBy}</T.Text>
        </T.Text>
      )
    );
  };

  get appointmentViewModel() {
    const { appointment, timezone } = this.props;
    return new AppointmentCardMenuViewModel(appointment, appointment.timezone || timezone);
  }

  render() {
    const viewModel = this.appointmentViewModel;
    const isCompleteOrCanceled = viewModel.completed || viewModel.canceled;
    const units = viewModel.unitsAsText;
    const {
      title,
      appointment: { agentName },
      appointmentResult,
      notes,
      tourType,
    } = viewModel;

    const translatedAppointmentResult = t(appointmentResult);

    const titleExtension = isSelfServiceAppointment(this.props.appointment.metadata) ? ` ${t('SELF_SERVICE')}` : '';

    const prefix = appointmentResult ? `${translatedAppointmentResult}: ` : '';
    let appointmentTitle = `${t('APPOINTMENT_TITLE', { title, agentName })}${titleExtension}`;

    const tourTypeLabel = getTourTypesForAppointmentCard().find(type => type.id === tourType)?.text;

    if (prefix) {
      appointmentTitle = (
        <T.SubHeader>
          <T.SubHeader bold inline>
            {prefix}
          </T.SubHeader>
          <T.SubHeader inline>{appointmentTitle}</T.SubHeader>
        </T.SubHeader>
      );
    }

    return (
      <div data-id="appointment-card" className={cf('appointment-card')}>
        <div className={cf('appointment-details', { isCompleteOrCanceled })}>
          {isString(appointmentTitle) ? <T.SubHeader>{appointmentTitle}</T.SubHeader> : appointmentTitle}
          <div style={{ marginBottom: '3px' }}>
            <GuestList TagElement={T.Text} data-id="guests" inline guests={viewModel.appointmentPartyMembers} />
            {units && (
              <T.Text data-id="units" inline secondary>{` ${t('VISITING', {
                units,
              })}`}</T.Text>
            )}
            {tourTypeLabel && <T.Text inline secondary>{` ${tourTypeLabel}`}</T.Text>}
          </div>
          <T.Text data-id="notes" secondary>
            {notes}
          </T.Text>
          {isCompleteOrCanceled && this.renderClosingNote()}
          {!isCompleteOrCanceled && this.renderDeclinedBy()}
        </div>
        <AppointmentCardMenu
          data-id="appointment-card-options"
          iconClassName={cf('actions')}
          menuListClassName={cf('actions-overlay')}
          viewModel={viewModel}
          handleEdit={this.handleEdit}
          onClickMenuAction={this.props.onClickMenuAction}
          appointment={this.props.appointment}
        />
      </div>
    );
  }
}
