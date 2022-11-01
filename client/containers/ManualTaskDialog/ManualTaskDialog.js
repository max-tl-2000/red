/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import notifier from 'helpers/notifier/notifier';
import { saveTask, updateTask, closeTaskDialog } from 'redux/modules/tasks';
import { t } from 'i18next';
import { Button, TextBox, Icon, PreloaderBlock, Dialog, DialogOverlay, DialogActions, FlyOut, FlyOutOverlay } from 'components';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './ManualTaskDialog.scss';
import { isTaskComplete } from '../../helpers/taskUtils';
import EmployeeSelector from '../Dashboard/EmployeeSelector';
import EmployeeCard from '../Dashboard/EmployeeCard';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';
import DateSelector from '../../components/DateSelector/DateSelector';
import { toMoment, now } from '../../../common/helpers/moment-utils';

@connect(
  (state, props) => ({
    currentUserId: (state.auth.user || {}).id,
    loggedInUser: state.auth.user,
    isEnabled: state.tasks.isEnabled,
    task: state.tasks.task,
    isSaving: state.tasks.isSaving,
    error: state.tasks.error,
    isRequireWorkTask: state.tasks.isRequireWorkTask,
    timezone: getPartyTimezone(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        saveTask,
        updateTask,
        closeTaskDialog,
      },
      dispatch,
    ),
)
export default class ManualTaskDialog extends Component {
  static propTypes = {
    partyId: PropTypes.string.isRequired,
    selectorData: PropTypes.object.isRequired,
    currentUserId: PropTypes.string.isRequired,
    isEnabled: PropTypes.bool,
    isSaving: PropTypes.bool,
    closeTaskDialog: PropTypes.func,
    saveTask: PropTypes.func,
    showSnackbarMessage: PropTypes.func,
    isRequireWorkTask: PropTypes.bool,
    partyOwnerId: PropTypes.string,
    ownerTeamId: PropTypes.string,
  };

  defaultState = ({ selectedAgentId, selectedTeamId, timezone }) => ({
    selectedAgentId,
    selectedTeamId,
    note: '',
    name: '',
    dueDate: now({ timezone }).endOf('day').add(1, 'days'),
    isComplete: false,
  });

  existingState = (task, timezone) => ({
    selectedAgentId: task.userIds[0],
    selectedTeamId: task.metadata.teamId,
    name: task.name,
    note: task.metadata.note,
    dueDate: toMoment(task.dueDate, { timezone }),
    isComplete: isTaskComplete(task),
    closingNote: task.metadata.closingNote || '',
  });

  constructor(props) {
    super(props);
    const { partyOwnerId, timezone } = this.props;
    const selectedAgentId = this.getAgentId(props.task) || partyOwnerId;
    const selectedTeamId = this.getTeamId(props.task) || props.ownerTeamId;
    this.state = this.defaultState({ selectedAgentId, selectedTeamId, timezone });
  }

  componentWillMount = () => {
    if (this.props.task) {
      const { task, timezone } = this.props;
      this.setState(this.existingState(task, timezone));
    }
  };

  componentWillReceiveProps = nextProps => {
    if (nextProps.task && !nextProps.isSaving) {
      const { task, timezone } = nextProps;
      this.setState(this.existingState(task, timezone));
    }
  };

  componentDidUpdate = prevProps => {
    const { timezone, isEnabled, currentUserId, isSaving } = this.props;
    const isDialogOpening = !prevProps.isEnabled && isEnabled;
    if (isDialogOpening) {
      this.setState(this.defaultState({ selectedAgentId: currentUserId, timezone }));
    }

    const isDoneSaving = prevProps.isSaving && !isSaving;
    if (isDoneSaving) {
      if (this.props.error) {
        notifier.error(t(this.props.error));
      } else {
        const { isRequireWorkTask, showSnackbarMessage } = this.props;
        this.props.closeTaskDialog();

        const agent = this.getLeasingAgent();
        isRequireWorkTask && showSnackbarMessage && showSnackbarMessage(agent ? agent.fullName : '');
      }
    }
  };

  getAgentId = task => (task ? task.userIds[0] : this.state && this.state.selectedAgentId);

  getTeamId = task => (task ? task.metadata.teamId : this.state && this.state.selectedTeamId);

  handleLeasingAgentChange = selectedItem => {
    this.refs.employeeSelectorFlyout.close();

    const selectedAgentId = selectedItem.userId;
    const selectedTeamId = selectedItem.teamId;
    if (selectedAgentId !== this.state.selectedAgentId || selectedTeamId !== this.state.selectedTeamId) {
      this.setState({
        selectedAgentId,
        selectedTeamId,
      });
    }
  };

  handleFieldChange = (field, value) => {
    this.setState({
      [field]: value,
    });
  };

  saveTask = () => {
    const { selectedAgentId, selectedTeamId, name, note, dueDate, isComplete, closingNote } = this.state;
    const { task, partyId, isRequireWorkTask } = this.props;

    const taskObject = {
      name,
      userIds: [selectedAgentId],
      dueDate,
      metadata: {
        note,
        teamId: selectedTeamId,
      },
    };

    if (isComplete) {
      taskObject.metadata.closingNote = closingNote;
    }

    if (task && task.id) {
      taskObject.id = task.id;
      this.props.updateTask({
        ...taskObject,
        id: task.id,
      });
    } else {
      this.props.saveTask({
        ...taskObject,
        partyId,
        state: DALTypes.TaskStates.ACTIVE,
        category: isRequireWorkTask ? DALTypes.TaskCategories.REQUIRE_WORK : DALTypes.TaskCategories.MANUAL,
      });
    }
  };

  cancel = () => {
    const { currentUserId, timezone } = this.props;
    this.setState({
      ...this.defaultState({ selectedAgentId: currentUserId, timezone }),
    });
    this.props.closeTaskDialog();
  };

  getLabels = () => {
    const { isRequireWorkTask, task } = this.props;
    if (isRequireWorkTask) {
      return {
        dialogTitle: t('REQUIRE_WORK_FORM_TITLE'),
        submitButton: t('REQUIRE_WORK_FORM_SUBMIT_BUTTON'),
        taskNotesTextboxLabel: t('REQUIRE_WORK_FORM_DESCRIPTION_LABEL'),
        titleTextboxValue: '',
        taskTitleTextboxLabel: t('MANUAL_TASK_FORM_TITLE'),
      };
    }
    return {
      dialogTitle: task ? t('MANUAL_TASK_FORM_EDIT_TASK') : t('MANUAL_TASK_FORM_ADD_TASK'),
      submitButton: task ? t('SAVE_BUTTON') : t('BUTTON_ADD_TASK'),
      taskNotesTextboxLabel: t('MANUAL_TASK_FORM_NOTES'),
      titleTextboxValue: this.state.name,
      taskTitleTextboxLabel: t('MANUAL_TASK_FORM_TITLE'),
    };
  };

  selectTitleText = () => {
    if (this.props.isRequireWorkTask) {
      this.textbox.select();
    } else {
      this.textbox.focus();
    }
  };

  selectDefaultUser = () => {
    if (this.props.isRequireWorkTask) {
      this.setState({ selectedAgentId: this.props.partyOwnerId });
    }
  };

  getLeasingAgent = () => {
    const { selectorData } = this.props;
    const { selectedAgentId, selectedTeamId } = this.state;

    if (selectedTeamId) {
      return (selectorData.allUsers && selectorData.allUsers.find(u => u.id === selectedAgentId && u.currentTeamId === selectedTeamId)) || {};
    }

    return (selectorData.allUsers && selectorData.allUsers.find(u => u.id === selectedAgentId)) || {};
  };

  isDateDisabled = day => {
    const { timezone } = this.props;
    const today = now({ timezone });
    return today.isAfter(day, 'day');
  };

  changeTaskDueDate = day => {
    if (!day) {
      this.handleFieldChange('dueDate', day);
      return;
    }
    const { timezone } = this.props;
    day = toMoment(day, { timezone }).clone().endOf('day'); // tasks are due at the end of the day. Should we migrate the tasks data?
    this.handleFieldChange('dueDate', day);
  };

  render = () => {
    const { isEnabled, isSaving, selectorData, timezone, loggedInUser } = this.props;

    const { note, dueDate, isComplete, closingNote, name } = this.state;

    const addTaskDisabled = !name || !dueDate;
    const labels = this.getLabels();

    const leasingAgent = this.getLeasingAgent();

    return (
      <Dialog
        open={isEnabled}
        appendToBody
        baseZIndex={200}
        closeOnTapAway={false}
        onOpen={this.selectTitleText}
        onOpening={this.selectDefaultUser}
        onCloseRequest={this.cancel}>
        <DialogOverlay title={labels.dialogTitle}>
          <div className={cf('form-container')} data-id="taskDialog">
            <TextBox
              label={labels.taskTitleTextboxLabel}
              ref={input => {
                this.textbox = input;
              }}
              value={labels.titleTextboxValue}
              onChange={({ value }) => this.handleFieldChange('name', value)}
              autoResize={false}
              required
              className={cf('form-element')}
              dataId="manualTaskName"
            />
            <TextBox
              label={labels.taskNotesTextboxLabel}
              value={note}
              onBlur={(e, { value }) => this.handleFieldChange('note', value)}
              multiline={true}
              numRows={6}
              autoResize={false}
              className={cf('form-element')}
              dataId="manualTaskNotes"
            />
            {isComplete && (
              <TextBox
                label={t('CLOSING_NOTES')}
                value={closingNote}
                onBlur={(e, { value }) => this.handleFieldChange('closingNote', value)}
                multiline
                numRows={4}
                autoResize={false}
                className={cf('form-element')}
              />
            )}
            <DateSelector
              placeholder={t('MANUAL_TASK_FORM_DUE_DATE')}
              label={t('MANUAL_TASK_FORM_DUE_DATE')}
              appendToBody={false}
              tz={timezone}
              wide
              selectedDate={dueDate ? toMoment(dueDate, { timezone }) : undefined}
              id="manualTaskDueDate"
              onChange={this.changeTaskDueDate}
              isDateDisabled={this.isDateDisabled}
              textBoxClassName={cf('form-element')}
            />
            <FlyOut ref="employeeSelectorFlyout" expandTo="bottom-right" overTrigger>
              <Button data-id="employeeDropDown" type="wrapper" className={cf('dropdown')}>
                <EmployeeCard employeeName={leasingAgent.fullName} avatarUrl={leasingAgent.avatarUrl} title={leasingAgent.titleInTeam || leasingAgent.title} />
                <div className={cf('dd-icon')}>
                  <Icon name="menu-down" />
                </div>
              </Button>
              <FlyOutOverlay container={false} elevation={2}>
                <EmployeeSelector
                  suggestedUsers={selectorData.users}
                  users={selectorData.allUsers}
                  currentUser={loggedInUser}
                  onEmployeeSelected={this.handleLeasingAgentChange}
                  placeholderText={t('FIND_MORE')}
                />
              </FlyOutOverlay>
            </FlyOut>
          </div>
          <DialogActions>
            <Button data-id="cancelEditTaskDialog" type="flat" btnRole="secondary" useWaves={true} label={t('CANCEL')} onClick={this.cancel} />
            <Button data-id="saveEditTaskDialog" type="flat" useWaves={true} onClick={this.saveTask} disabled={addTaskDisabled} label={labels.submitButton} />
          </DialogActions>
          {isSaving && <PreloaderBlock modal />}
        </DialogOverlay>
      </Dialog>
    );
  };
}
