/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { RedTable as RT, Typography as T, Button } from 'components';
import { t } from 'i18next';
import { orderedGuestNames } from 'helpers/infoToDisplayOnPerson';
import { markTaskAsComplete, startEditingTask, updateTask, markTaskAsCanceled } from 'redux/modules/tasks';
import { startEditingAppointment, markAppointmentAsCanceled, markAppointmentAsComplete, unmarkAppointmentAsComplete } from 'redux/modules/appointments.dialog';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { windowOpen } from 'helpers/win-open';
import { searchUnits } from 'redux/modules/inventoryStore';
import toArray from 'helpers/toArray';
import { getTaskDueDate, isTaskComplete, shouldTaskShowGuestName, getFormattedTaskTitle, filterVisibleTasks } from '../../../helpers/taskUtils';
import TaskCard from './TaskCard';
import MarkAsCompleteTaskDialog from '../../MarkAsCompleteTaskDialog/MarkAsCompleteTaskDialog';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getDisplayName } from '../../../../common/helpers/person-helper';
import { now, toMoment } from '../../../../common/helpers/moment-utils';
import { cf } from './TaskList.scss';
@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        markAppointmentAsComplete,
        unmarkAppointmentAsComplete,
        markTaskAsComplete,
        markAppointmentAsCanceled,
        markTaskAsCanceled,
        startEditingTask,
        startEditingAppointment,
        updateTask,
        searchUnits,
      },
      dispatch,
    ),
)
export default class TaskList extends Component {
  static propTypes = {
    tasks: PropTypes.object,
    selectorData: PropTypes.object,
    persons: PropTypes.object,
    partyMembers: PropTypes.object,
    inactiveMembers: PropTypes.object,
    leases: PropTypes.object,
    currentUser: PropTypes.object,
    startEditingTask: PropTypes.func,
    startEditingAppointment: PropTypes.func,
    sendMessage: PropTypes.func,
    updateTask: PropTypes.func,
    onReviewApplicationTaskNameClick: PropTypes.func,
    onNotifyConditionalApprovalClick: PropTypes.func,
    party: PropTypes.object,
    enhancedAppointments: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = {
      orderedTasks: this.orderTasks(props.tasks),
      openCompleteDialog: false,
      taskToClose: props.taskToClose,
      dialogTitle: props.closeTaskDialogTitle || '',
      areTasksCollapsed: true,
    };
  }

  componentWillReceiveProps = nextProps => {
    if (this.props.tasks !== nextProps.tasks) {
      this.setState({ orderedTasks: this.orderTasks(nextProps.tasks) });
    }
  };

  onTaskClickComplete = (e, task) => {
    // make the Menu remain open to provide some context
    e.stopPropagation();

    this.setState({
      openCompleteDialog: true,
      taskToClose: task,
      actionType: DALTypes.AppointmentResults.COMPLETE,
    });
  };

  handleUndoComplete = (e, task) => {
    this.props.unmarkAppointmentAsComplete(task.id, task.category);
  };

  onClickCancel = () => this.setState({ openCompleteDialog: false });

  onClickDone = (task, note, appointmentResult, inventories, sendConfirmationEmail) => {
    if (task.name === DALTypes.TaskNames.APPOINTMENT) {
      appointmentResult === DALTypes.AppointmentResults.COMPLETE
        ? this.props.markAppointmentAsComplete({
            id: task.id,
            note,
            appointmentResult,
            inventories,
          })
        : this.props.markAppointmentAsCanceled(
            {
              id: task.id,
              note,
              appointmentResult,
            },
            sendConfirmationEmail,
          );
      this.setState({ openCompleteDialog: false });
    } else {
      this.props.markTaskAsComplete(task.id, note);
      this.setState({ openCompleteDialog: false });
    }
  };

  onCancelTask = task => {
    this.props.markTaskAsCanceled(task.id);
    this.setState({ openCompleteDialog: false });
  };

  handleEditTask = task => {
    if (task.category === DALTypes.TaskCategories.APPOINTMENT) {
      const appointment = this.props.enhancedAppointments.get(task.id);
      this.props.startEditingAppointment(appointment);
    } else {
      this.props.startEditingTask(task);
    }
  };

  handleOnAssignTask = (taskId, selectedEmployee) => {
    this.props.updateTask({
      id: taskId,
      userIds: [selectedEmployee.userId],
      metadata: {
        teamId: selectedEmployee.teamId,
      },
    });
  };

  handleCounterSignerClick = task => {
    const { leases, currentUser } = this.props;
    const lease = leases.get(task.metadata.leaseId);
    const countersignerSignature = lease.signatures.find(s => s.userId === currentUser.id);
    const signUrl = countersignerSignature && countersignerSignature.signUrl;
    signUrl && windowOpen(signUrl);
  };

  handleTaskClick = task => {
    switch (task.name) {
      case DALTypes.TaskNames.COUNTERSIGN_LEASE: {
        this.handleCounterSignerClick(task);
        break;
      }
      case DALTypes.TaskNames.REVIEW_APPLICATION: {
        const { onReviewApplicationTaskNameClick } = this.props;
        onReviewApplicationTaskNameClick && onReviewApplicationTaskNameClick(task);
        break;
      }
      case DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL: {
        const { onNotifyConditionalApprovalClick } = this.props;
        onNotifyConditionalApprovalClick && onNotifyConditionalApprovalClick();
        break;
      }
      default:
    }
  };

  orderTasks = tasks => {
    const { timezone } = this.props;
    if (tasks && tasks.size) {
      const tasksToShow = filterVisibleTasks(tasks, timezone);

      const overdueTasks = tasksToShow
        .filter(ts => ts.state === DALTypes.TaskStates.ACTIVE && now({ timezone }).isAfter(toMoment(ts.dueDate, { timezone }), 'day'))
        .sort((a, b) => toMoment(getTaskDueDate(a), { timezone }).diff(toMoment(getTaskDueDate(b), { timezone })));

      const activeTasks = tasksToShow
        .filter(
          ts =>
            ts.state === DALTypes.TaskStates.ACTIVE &&
            (now({ timezone }).isSame(toMoment(getTaskDueDate(ts), { timezone }), 'day') ||
              now({ timezone }).isBefore(toMoment(getTaskDueDate(ts), { timezone }))),
        )
        .sort((a, b) => toMoment(getTaskDueDate(a), { timezone }).diff(toMoment(getTaskDueDate(b), { timezone })));

      const completedTasks = tasksToShow
        .filter(ts => ts.state === DALTypes.TaskStates.COMPLETED || ts.state === DALTypes.TaskStates.CANCELED)
        .sort((a, b) => toMoment(b.updated_at, { timezone }).diff(toMoment(a.updated_at, { timezone })));

      return overdueTasks.concat(activeTasks, completedTasks).map(task => ({ ...task, formattedTaskTitle: this.formatTaskTitle(task) }));
    }
    return [];
  };

  formatTaskTitle = task => {
    const params = {};
    const metadata = task.metadata || {};
    if (shouldTaskShowGuestName(task)) {
      const person = this.props.persons.get(metadata.personId);
      if (!person) {
        // the person was not yet added to the store
        return '';
      }
      return t(task.name, { guestName: getDisplayName(person) });
    }
    if (task.name === DALTypes.TaskNames.APPOINTMENT) {
      const allPartyMembers = this.props.partyMembers.merge(this.props.inactiveMembers);
      const guestsNames = orderedGuestNames(metadata.partyMembers.map(pId => allPartyMembers.get(pId)).filter(p => !!p));
      const prefix = task.metadata.appointmentCreatedFrom === DALTypes.AppointmentCreatedFrom.SELF_SERVICE ? `${t('SELF_SERVICE')} ` : '';
      let appointmentTitle = prefix + t('APPOINTMENT_WITH', { guestsNames });

      if (metadata.appointmentResult) {
        const disabled = isTaskComplete(task);
        appointmentTitle = (
          <T.Text>
            <T.Text bold inline disabled={disabled}>{`${t(metadata.appointmentResult)}: `}</T.Text>
            <T.Text inline disabled={disabled}>
              {appointmentTitle}
            </T.Text>
          </T.Text>
        );
      }

      return appointmentTitle;
    }

    if (task.name === DALTypes.TaskNames.HOLD_INVENTORY) {
      const { holdDepositPayer, inventoryName, inventoryFullQualifiedName } = metadata;
      params.unit = inventoryFullQualifiedName || inventoryName;
      params.payerName = getDisplayName(holdDepositPayer, { usePreferred: true, ignoreContactInfo: true });
    }

    const manualTasks = [DALTypes.TaskCategories.MANUAL_REMINDER, DALTypes.TaskCategories.MANUAL];
    return manualTasks.includes(task.category) && !task.metadata?.formatTitle ? task.name : getFormattedTaskTitle(task, params);
  };

  handleAppointmentMenuAction = (model, actionType) => {
    this.setState({
      openCompleteDialog: true,
      taskToClose: model.appointment,
      actionType,
    });
  };

  handleCollapseTasks = () => this.setState({ areTasksCollapsed: !this.state.areTasksCollapsed });

  areThereCompletedTasks = orderedTasks => orderedTasks.some(task => isTaskComplete(task));

  filterIncompleteTasks = orderedTasks => orderedTasks.filter(task => !isTaskComplete(task));

  renderTasks = orderedTasks => {
    const { areTasksCollapsed } = this.state;
    const tasks = areTasksCollapsed ? this.filterIncompleteTasks(orderedTasks) : orderedTasks;

    return toArray(tasks).map((task, index) => (
      <TaskCard
        id={`task_${task.name}_${index}`}
        key={task.id}
        task={task}
        formattedValue={task.formattedTaskTitle}
        selectorData={this.props.selectorData}
        taskOwners={this.props.taskOwners}
        leases={this.props.leases}
        timezone={this.props.timezone}
        currentUser={this.props.currentUser}
        party={this.props.party}
        onClickEdit={this.handleEditTask}
        onAppointmentMenuAction={this.handleAppointmentMenuAction}
        onClickUndoComplete={this.handleUndoComplete}
        onClickComplete={this.onTaskClickComplete}
        onClickTaskName={this.handleTaskClick}
        onAssignTask={this.handleOnAssignTask}
        sendMessage={this.props.sendMessage}
      />
    ));
  };

  render = () => {
    const { orderedTasks, actionType, taskToClose, openCompleteDialog, areTasksCollapsed } = this.state;
    const buttonAction = areTasksCollapsed ? t('SHOW') : t('HIDE');

    return (
      <div>
        {orderedTasks.length === 0 ? (
          <div className={cf('no-task-wrapper')}>
            <T.Text>{t('THERE_ARE_NO_TASK')}</T.Text>
          </div>
        ) : (
          <div>
            <RT.Table>{this.renderTasks(orderedTasks)}</RT.Table>
            {this.areThereCompletedTasks(orderedTasks) && (
              <div className={cf('display-tasks-action')}>
                <Button type="flat" label={t('COMPLETED_TASKS', { action: buttonAction })} onClick={this.handleCollapseTasks} />
              </div>
            )}
            <MarkAsCompleteTaskDialog
              timezone={this.props.timezone}
              open={openCompleteDialog}
              onClickCancel={this.onClickCancel}
              onClickDone={this.onClickDone}
              onCancelTask={this.onCancelTask}
              task={taskToClose}
              searchUnits={this.props.searchUnits}
              actionType={actionType}
            />
          </div>
        )}
      </div>
    );
  };
}
