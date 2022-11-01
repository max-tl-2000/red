/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import uniq from 'lodash/uniq';
import { observable, computed, action } from 'mobx';
import { observer } from 'mobx-react';

import { Typography as T, Tooltip, Icon, FlyOut, FlyOutOverlay, CardMenu, CardMenuItem, RedTable } from 'components';

import { isString } from 'helpers/type-of';
import {
  taskDuedateFormat,
  isTaskReassignable,
  isTaskAutoclosing,
  isTaskComplete,
  isTaskEditable,
  isTaskOverdue,
  isTaskNameClickable,
  getClosingNote,
  getFeedbackForIcsRsvpDecline,
  isTaskDeclinedViaExtCalendar,
} from '../../../helpers/taskUtils';
import EmployeeSelector from '../../Dashboard/EmployeeSelector';
import { cf } from './TaskCard.scss';
import { isRevaAdmin } from '../../../../common/helpers/auth';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { AppointmentCardMenuViewModel } from '../../AppointmentList/AppointmentCardMenuViewModel';
import AppointmentCardMenu from '../../AppointmentList/AppointmentCardMenu';
import { isSelfServiceAppointment } from '../../../../common/helpers/tasks';

const { Money } = RedTable;

@observer
export default class TaskCard extends Component {
  @observable
  _viewModel;

  @computed
  get viewModel() {
    return this._viewModel;
  }

  constructor(props) {
    super(props);
    this.syncTask(props.task, props.timezone);
  }

  @action
  syncTask(task, timezone) {
    this._viewModel = new AppointmentCardMenuViewModel(task, timezone);
  }

  componentWillReceiveProps(nextProps) {
    const { props } = this;
    if (nextProps.task !== props.task) {
      this.syncTask(nextProps.task, nextProps.timezone);
    }
  }

  static propTypes = {
    task: PropTypes.object,
    formattedValue: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    selectorData: PropTypes.object,
    currentUser: PropTypes.object,
    party: PropTypes.object,
    onClickEdit: PropTypes.func,
    onClickComplete: PropTypes.func,
    onClickTaskName: PropTypes.func,
    onAssignTask: PropTypes.func,
    id: PropTypes.string,
  };

  getUsersNames = () => {
    const { taskOwners, task } = this.props;
    const users = (taskOwners || []).filter(user => task.userIds.includes(user.id)).map(user => user.fullName);
    return uniq(users).join(', ');
  };

  handleOnAssignTask = selectedEmployee => {
    this.refEmployeeSelectorFlyout.close();
    this.refCardMenu && this.refCardMenu.close();
    const { onAssignTask, task } = this.props;
    onAssignTask(task.id, selectedEmployee);
  };

  tooltipText = () => {
    const taskNames = DALTypes.TaskNames;

    const tooltipsMap = {
      [`${taskNames.INTRODUCE_YOURSELF}`]: t('INTRODUCE_YOURSELF_TOOLTIP'),
      [`${taskNames.APPOINTMENT}`]: t('APPOINTMENT_TOOLTIP'),
      [`${taskNames.FOLLOWUP_PARTY}`]: t('FOLLOWUP_PARTY_TOOLTIP'),
      [`${taskNames.COMPLETE_CONTACT_INFO}`]: t('COMPLETE_CONTACT_INFO_TOOLTIP'),
      [`${taskNames.REMOVE_ANONYMOUS_EMAIL}`]: t('REMOVE_ANONYMOUS_EMAIL_TOOLTIP'),
      [`${taskNames.REVIEW_APPLICATION}`]: t('REVIEW_APPLICATION_TOOLTIP'),
      [`${taskNames.PROMOTE_APPLICATION}`]: t('PROMOTE_APPLICATION_TOOLTIP'),
      [`${taskNames.COUNTERSIGN_LEASE}`]: t('COUNTERSIGN_LEASE_TOOLTIP'),
      [`${taskNames.NOTIFY_CONDITIONAL_APPROVAL}`]: t('NOTIFY_CONDITIONAL_APPROVAL_TOOLTIP'),
      [`${taskNames.SEND_CONTRACT}`]: t('SEND_CONTRACT_TOOLTIP'),
      [`${taskNames.HOLD_INVENTORY}`]: t('HOLD_INVENTORY_TOOLTIP'),
      [`${taskNames.SEND_RENEWAL_QUOTE}`]: t('SEND_RENEWAL_QUOTE_TOOLTIP'),
      [`${taskNames.SMS_CONVERSATION_FOLLOWUP}`]: t('SMS_CONVERSATION_FOLLOWUP'),
      [`${taskNames.COLLECT_EMERGENCY_CONTACT}`]: t('COLLECT_EMERGENCY_CONTACT_TOOLTIP'),
    };

    return tooltipsMap[this.props.task.name] || t('AUTOMATICALLY_GENERATED_TOOLTIP');
  };

  titlePrefix = () =>
    this.props.task.name === DALTypes.TaskNames.APPOINTMENT && isSelfServiceAppointment(this.props.task.metadata) ? `${t('SELF_SERVICE')} ` : '';

  storeRefForEmployeeSelector = ref => {
    this.refEmployeeSelectorFlyout = ref;
  };

  storeRefForCardMenu = ref => {
    this.refCardMenu = ref;
  };

  isClosableByAdmin = () => {
    const { task, currentUser } = this.props;
    return isTaskAutoclosing(task) && isRevaAdmin(currentUser) && !isTaskComplete(task);
  };

  renderCardMenu = () => {
    const { task, selectorData, currentUser, party, onClickEdit, onClickComplete, onAppointmentMenuAction, onClickUndoComplete } = this.props;

    const isComplete = isTaskComplete(task);
    const isReassignable = isTaskReassignable(task);
    const isAutoclosing = isTaskAutoclosing(task);
    const isEditable = isTaskEditable(task, currentUser, party);

    const showMarkDone = !(isAutoclosing || isComplete);
    const showMarkUnDone = isComplete;

    const isAppointment = task.category === DALTypes.TaskCategories.APPOINTMENT;

    const assignComponent = (
      <FlyOut ref={this.storeRefForEmployeeSelector} expandTo="bottom-left" overTrigger>
        <CardMenuItem data-id="assignManualTask" text={t('ASSIGN')} disabled={!isReassignable || isComplete} onClick={e => e.stopPropagation()} />
        <FlyOutOverlay container={false} elevation={2}>
          <EmployeeSelector
            suggestedUsers={selectorData.users}
            users={selectorData.allUsers}
            currentUser={currentUser}
            onEmployeeSelected={this.handleOnAssignTask}
            placeholderText={t('FIND_MORE')}
          />
        </FlyOutOverlay>
      </FlyOut>
    );

    if (isAppointment) {
      return (
        <AppointmentCardMenu
          ref={this.storeRefForAppointmentCardMenu}
          viewModel={this.viewModel}
          handleEdit={() => onClickEdit(task)}
          onClickMenuAction={onAppointmentMenuAction}
          appointment={task}
        />
      );
    }

    if (this.isClosableByAdmin()) {
      return (
        <CardMenu ref={this.storeRefForCardMenu} iconName="dots-vertical">
          <CardMenuItem text={t('CANCEL_TASK')} onClick={e => onClickComplete(e, task)} />
        </CardMenu>
      );
    }

    return (
      <CardMenu ref={this.storeRefForCardMenu} iconName="dots-vertical">
        <CardMenuItem data-id="editManualTask" text={t('EDIT')} disabled={!isEditable} onClick={() => onClickEdit(task)} />
        {assignComponent}
        {showMarkDone && <CardMenuItem data-id="markDone" text={t('MARK_DONE')} onClick={e => onClickComplete(e, task)} />}
        {showMarkUnDone && <CardMenuItem data-id="unmarkDone" text={t('MARK_NOT_DONE')} onClick={e => onClickUndoComplete(e, task)} />}
      </CardMenu>
    );
  };

  getClosingNotesLabel = metadata => `${metadata.feedback ? t('CANCELLED_BY_GUEST') : t(metadata.appointmentResult)}. `;

  renderClosingNotes = () => {
    const {
      task,
      party: { partyMembers },
    } = this.props;

    const closingNote = getClosingNote(task, partyMembers);

    return (
      closingNote?.message && (
        <T.Text style={{ marginTop: '.5rem', marginBottom: '.5rem' }}>
          <T.Text inline bold disabled>{`${t('CLOSING_NOTES')}: `}</T.Text>
          <T.Text inline disabled>
            {closingNote.label}
          </T.Text>
          <T.Text inline disabled>
            {closingNote.message}
          </T.Text>
        </T.Text>
      )
    );
  };

  renderDeclinedBy = () => {
    const {
      task,
      party: { partyMembers },
    } = this.props;
    const declinedBy = getFeedbackForIcsRsvpDecline(task, partyMembers);

    return (
      isTaskDeclinedViaExtCalendar(task) && (
        <T.Text style={{ marginTop: '.5rem' }}>
          <T.Text bold inline>
            {`${t('DECLINED')}: `}
          </T.Text>
          <T.Text inline>{declinedBy}</T.Text>
        </T.Text>
      )
    );
  };

  renderConditionApprovalTask = (conditions, isComplete) => {
    if (!conditions) return '';
    const tooltips = [];

    const sureDeposit = conditions.sureDeposit ? `${t('SURE_DEPOSIT')}` : '';
    sureDeposit && tooltips.push(sureDeposit);
    const npsRentAssurance = conditions.npsRentAssurance ? `${t('NPS_RENT_ASSURANCE')}` : '';
    npsRentAssurance && tooltips.push(npsRentAssurance);
    const taskTooltip = tooltips.join(', ');

    return tooltips.length ? <T.Caption disabled={isComplete}>{taskTooltip}</T.Caption> : '';
  };

  render = () => {
    const { task, formattedValue, currentUser, party, onClickComplete, onClickTaskName, timezone, id } = this.props;

    if (!task) return <noscript />;

    const isComplete = isTaskComplete(task);
    const isReassignable = isTaskReassignable(task);
    const isAutoclosing = isTaskAutoclosing(task);
    const isEditable = isTaskEditable(task, currentUser, party);
    const isOverdue = isTaskOverdue(task, timezone);
    const isClickable = isTaskNameClickable(task, currentUser.id);

    const isOverflowMenuVisible = isEditable || isReassignable || !isAutoclosing || this.isClosableByAdmin();

    const metadata = task.metadata || {};

    return (
      <RedTable.Row data-id="appointment-row" key={task.id}>
        <RedTable.Cell width={70}>
          {isAutoclosing && !isComplete && (
            <Tooltip text={this.tooltipText()}>
              <Icon name="checkbox-blank-outline" className={isComplete || isAutoclosing ? '' : cf('completeIcon')} disabled />
            </Tooltip>
          )}
          {!isAutoclosing && !isComplete && (
            <div onClick={e => onClickComplete(e, task)}>
              <Icon name="checkbox-blank-outline" className={cf('completeIcon')} />
            </div>
          )}
          {isComplete && <Icon name="check" disabled />}
        </RedTable.Cell>
        <RedTable.Cell>
          <div className={cf('taskDetails', { clickable: isClickable })} onClick={() => isClickable && onClickTaskName(task)}>
            {isString(formattedValue) ? (
              <T.Text data-id={id} disabled={isComplete}>
                {formattedValue}
              </T.Text>
            ) : (
              formattedValue
            )}
            {!!metadata.conditions && !!metadata.conditions.additionalDeposit && !!metadata.conditions.additionalDepositAmount && (
              <T.Caption disabled={isComplete}>
                {t('APPROVAL_DIALOG_ADDITIONAL_DEPOSIT_TO')} <Money amount={metadata.conditions.additionalDepositAmount} noFormat />
              </T.Caption>
            )}
            {this.renderConditionApprovalTask(metadata?.conditions, isComplete)}
            {!!metadata.note && (
              <T.Text secondary disabled={isComplete}>
                {metadata.note}
              </T.Text>
            )}

            {isComplete && this.renderClosingNotes()}
            <T.Text error={isOverdue} secondary={!isOverdue} disabled={isComplete}>
              {taskDuedateFormat(task, timezone)}
            </T.Text>
            {!isComplete && this.renderDeclinedBy()}
          </div>
        </RedTable.Cell>
        <RedTable.Cell width="30%">
          <T.Text data-id="taskOwnerName" disabled={isComplete}>
            {this.getUsersNames()}
          </T.Text>
        </RedTable.Cell>
        <RedTable.Cell data-id="manualTask_menu" type="ctrlCell" width={86} textAlign="center">
          {isOverflowMenuVisible && this.renderCardMenu()}
        </RedTable.Cell>
      </RedTable.Row>
    );
  };
}
