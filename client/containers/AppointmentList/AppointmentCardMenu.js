/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import snackbar from 'helpers/snackbar/snackbar';
import { t } from 'i18next';
import { startRemovingAppointment, unmarkAppointmentAsComplete } from 'redux/modules/appointments.dialog';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { CardMenu, CardMenuItem, FlyOut, FlyOutOverlay } from 'components';
import { updateTask } from 'redux/modules/tasks';
import { isTaskComplete, isTaskReassignable } from '../../helpers/taskUtils';
import EmployeeSelector from '../Dashboard/EmployeeSelector';
import { DALTypes } from '../../../common/enums/DALTypes';

@connect(
  state => ({
    selectorDataForUser: state.personsStore.selectorData,
    selectorDataForParty: state.partyStore.selectorDataForParty,
    loggedInUser: state.auth.user,
  }),
  dispatch =>
    bindActionCreators(
      {
        startRemovingAppointment,
        unmarkAppointmentAsComplete,
        updateTask,
      },
      dispatch,
    ),
)
export default class AppointmentCardMenu extends Component {
  static propTypes = {
    menuListClassName: PropTypes.string,
    iconClassName: PropTypes.string,
    viewModel: PropTypes.object.isRequired,
    startRemovingAppointment: PropTypes.func,
    unmarkAppointmentAsComplete: PropTypes.func.isRequired,
    onClickMenuAction: PropTypes.func.isRequired,
  };

  handleUnmarkAsComplete = () => this.props.unmarkAppointmentAsComplete(this.props.viewModel.getAppointmentId());

  handleEdit = () => {
    const { handleEdit, viewModel } = this.props;
    const { appointment } = viewModel;

    handleEdit && handleEdit({ appointment });
  };

  storeRefForCardMenu = ref => {
    this.refCardMenu = ref;
  };

  close = () => {
    this.refCardMenu.close();
  };

  storeRefForEmployeeSelector = ref => {
    this.refEmployeeSelector = ref;
  };

  doAssignTask = (task, checkConflictingAppointments, selectedEmployee) => {
    if (!selectedEmployee) return;

    const oldAppointment = this.props.appointment;
    const alreadyOwner = selectedEmployee.userId === oldAppointment.userIds[0];

    if (alreadyOwner) {
      snackbar.show({ text: t('IS_ALREADY_PRIMARY_AGENT_ON_APPOINTMENT', { name: selectedEmployee.fullName }) });
    } else {
      this.props.updateTask(task, false, checkConflictingAppointments);
    }
  };

  handleOnAssignTask = selectedEmployee => {
    this.refEmployeeSelector.close();
    this.close();
    const { props } = this;
    const {
      viewModel: { appointment },
    } = props;
    this.doAssignTask(
      {
        id: appointment.id,
        userIds: [selectedEmployee.userId],
        metadata: {
          teamId: selectedEmployee.teamId,
        },
      },
      true,
      selectedEmployee,
    );
  };

  render() {
    const {
      viewModel,
      iconClassName,
      menuListClassName,
      onClickMenuAction,
      allowMarkAsDone = true,
      selectorDataForUser,
      selectorDataForParty,
      loggedInUser,
    } = this.props;

    // TODO: move this into the viewModel
    const isComplete = isTaskComplete(viewModel.appointment);
    const isReassignable = isTaskReassignable(viewModel.appointment);

    const assignOption = (
      <FlyOut ref={this.storeRefForEmployeeSelector} expandTo="bottom-left" overTrigger>
        <CardMenuItem
          data-id="appointment-card-menu-item-assign"
          text={t('ASSIGN')}
          disabled={!isReassignable || isComplete}
          onClick={e => e.stopPropagation()}
        />
        <FlyOutOverlay container={false} elevation={2}>
          <EmployeeSelector
            suggestedUsers={selectorDataForUser.users || selectorDataForParty.users}
            users={selectorDataForUser.allUsers || selectorDataForParty.allUsers}
            currentUser={loggedInUser}
            onEmployeeSelected={this.handleOnAssignTask}
            placeholderText={t('FIND_MORE')}
          />
        </FlyOutOverlay>
      </FlyOut>
    );

    return (
      <CardMenu
        data-id="appointment-card-menu"
        ref={this.storeRefForCardMenu}
        iconClassName={iconClassName}
        menuListClassName={menuListClassName}
        iconName="dots-vertical">
        <CardMenuItem data-id="appointment-card-menu-item-edit" disabled={!viewModel.editable} onClick={this.handleEdit} text={t('EDIT_APPOINTMENT')} />
        {assignOption}
        {viewModel.isMarkAsCompleteVisible && allowMarkAsDone && (
          <CardMenuItem
            data-id="appointment-card-menu-item-mark-done"
            onClick={() => onClickMenuAction(viewModel, DALTypes.AppointmentResults.COMPLETE)}
            disabled={!viewModel.isMarkAsCompleteEnabled}
            text={t('MARK_DONE')}
          />
        )}
        {viewModel.isUnMarkAsCompleteVisible && (
          <CardMenuItem data-id="appointment-card-menu-item-mark-not-done" onClick={this.handleUnmarkAsComplete} text={t('MARK_NOT_DONE')} />
        )}
        {viewModel.isMarkAsNoShowVisible && (
          <CardMenuItem
            data-id="appointment-card-menu-item-mark-no-show"
            onClick={() => onClickMenuAction(viewModel, DALTypes.AppointmentResults.NO_SHOW)}
            disabled={!viewModel.isMarkAsNoShowEnabled}
            text={t('MARK_NOSHOW')}
          />
        )}
        {viewModel.isCancelVisible && (
          <CardMenuItem
            data-id="appointment-card-menu-item-cancel"
            onClick={() => onClickMenuAction(viewModel, DALTypes.AppointmentResults.CANCELLED)}
            text={t('CANCEL_APPOINTMENT')}
          />
        )}
      </CardMenu>
    );
  }
}
