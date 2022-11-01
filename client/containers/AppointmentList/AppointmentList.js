/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { PreloaderBlock, Section, Button } from 'components';
import sortBy from 'lodash/sortBy';
import { t } from 'i18next';
import { markAppointmentAsComplete, markAppointmentAsCanceled } from 'redux/modules/appointments.dialog';
import { bindActionCreators } from 'redux';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { searchUnits } from 'redux/modules/inventoryStore';

import { connect } from 'react-redux';
import { clearAssignTaskError, updateTask } from 'redux/modules/tasks';
import MarkAsCompleteTaskDialog from '../MarkAsCompleteTaskDialog/MarkAsCompleteTaskDialog';
import AppointmentCard from './AppointmentCard';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';
import AssignPartyAppointmentConflictDialog from '../ProspectDetailPage/AssignPartyAppointmentConflictDialog';
import { cf } from './AppointmentList.scss';

@connect(
  state => ({
    taskDetails: state.tasks.taskDetails,
  }),
  dispatch =>
    bindActionCreators(
      {
        markAppointmentAsComplete,
        markAppointmentAsCanceled,
        searchUnits,
        clearAssignTaskError,
        updateTask,
      },
      dispatch,
    ),
)
export default class AppointmentList extends Component {
  static propTypes = {
    appointments: PropTypes.array,
    loading: PropTypes.bool,
    editAppointment: PropTypes.func,
    defaultFocusedAppointmentId: PropTypes.string,
    sendMessage: PropTypes.func,
    partyMembers: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = {
      openCompleteDialog: false,
      appointmentToClose: undefined,
      dialogTitle: '',
      areAppointmentsCollapsed: true,
    };
  }

  onClickCancel = () => this.setState({ openCompleteDialog: false });

  onClickMenuAction = (model, actionType) => {
    this.setState({
      openCompleteDialog: true,
      appointmentToClose: model.appointment,
      actionType,
    });
  };

  onClickDone = (appointment, note, appointmentResult, inventories, sendConfirmationEmail) => {
    appointmentResult === DALTypes.AppointmentResults.COMPLETE
      ? this.props.markAppointmentAsComplete({
          id: appointment.id,
          note,
          appointmentResult,
          inventories,
        })
      : this.props.markAppointmentAsCanceled(
          {
            id: appointment.id,
            note,
            appointmentResult,
          },
          sendConfirmationEmail,
        );
    this.setState({ openCompleteDialog: false });
  };

  componentDidMount() {
    if (this.props.defaultFocusedAppointmentId) {
      const appointmentElement = findDOMNode(this.refs[this.props.defaultFocusedAppointmentId]);
      if (appointmentElement) {
        setTimeout(() => appointmentElement.scrollIntoView(), 0);
      }
    }
  }

  doAssignTask = (task, sendConfirmationMail, checkConflictingAppointments) => this.props.updateTask(task, sendConfirmationMail, checkConflictingAppointments);

  get assignTaskError() {
    return this.props.taskDetails || {};
  }

  get hasAssignTaskError() {
    const { assignTaskError } = this;
    return assignTaskError.token === 'APPOINTMENTS_CONFLICT';
  }

  handleCollapseAppointments = () => this.setState({ areAppointmentsCollapsed: !this.state.areAppointmentsCollapsed });

  areThereCompleteOrCanceledAppointments = appointments => appointments.some(appointment => appointment.state !== 'Active');

  filterActiveAppointments = appointments => appointments.filter(appointment => appointment.state === 'Active');

  renderAppointments = appointments => {
    const { areAppointmentsCollapsed } = this.state;
    const displayedAppointments = areAppointmentsCollapsed ? this.filterActiveAppointments(appointments) : appointments;

    return displayedAppointments.map(appointment => (
      <AppointmentCard
        key={appointment.id}
        ref={appointment.id}
        appointment={appointment}
        editAppointment={this.props.editAppointment}
        sendMessage={this.props.sendMessage}
        timezone={this.props.timezone}
        partyMembers={this.props.partyMembers}
        onClickMenuAction={this.onClickMenuAction}
      />
    ));
  };

  render({ appointments, loading, timezone, taskDetails } = this.props) {
    const sortedAppointments = sortBy(appointments, appointment => [appointment.state, -toMoment(appointment.metadata.startDate).utc()]);
    const appointmentCards = this.renderAppointments(sortedAppointments);

    const { openCompleteDialog, appointmentToClose, actionType, areAppointmentsCollapsed } = this.state;
    const buttonAction = areAppointmentsCollapsed ? t('SHOW') : t('HIDE');

    return (
      <Section data-id="appointmentSection" padContent={false} title={t('APPOINTMENTS_LABEL')}>
        {do {
          if (loading && !appointments) {
            <PreloaderBlock />;
          } else if (appointments.length > 0) {
            <div>
              <div>{appointmentCards}</div>
              {this.areThereCompleteOrCanceledAppointments(sortedAppointments) && (
                <div className={cf('display-appointments-action')}>
                  <Button type="flat" label={t('COMPLETED_APPOINTMENTS', { action: buttonAction })} onClick={this.handleCollapseAppointments} />
                </div>
              )}
              <MarkAsCompleteTaskDialog
                timezone={timezone}
                open={openCompleteDialog}
                onClickCancel={this.onClickCancel}
                onClickDone={this.onClickDone}
                task={appointmentToClose}
                searchUnits={this.props.searchUnits}
                actionType={actionType}
              />
              {this.hasAssignTaskError && (
                <AssignPartyAppointmentConflictDialog
                  open={this.hasAssignTaskError}
                  onClose={() => {
                    this.props.clearAssignTaskError();
                  }}
                  onOverbookRequest={this.doAssignTask}
                  selectedPartyAssignee={taskDetails.user} // this is used until we add a new specific dialog for this scenario
                  conflictingAppointmentIds={taskDetails.data.appointmentIds}
                  task={taskDetails.task}
                  sendConfirmationMail={taskDetails.sendConfirmationMail}
                  timezone={timezone}
                  appointments={appointments}
                />
              )}
            </div>;
          } else {
            <EmptyMessage style={{ paddingLeft: '1.5rem' }} message={t('APPOINTMENTS_NOT_FOUND')} dataId="noAppointmentMessage" />;
          }
        }}
      </Section>
    );
  }
}
