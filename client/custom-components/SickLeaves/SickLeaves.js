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
import { t } from 'i18next';
import { FlyOut, FlyOutOverlay, Button, Typography as T, Icon, Avatar, RedTable, IconButton } from 'components';
import handleFlyoutAnimation from 'helpers/employeesFlyoutAnimation';
import { getBusinessTitle } from 'helpers/users';
import * as sickLeavesActions from 'redux/modules/sickLeavesStore';
import { createSelector } from 'reselect';
import { cf } from './SickLeaves.scss';
import EmployeeSelector from '../../containers/Dashboard/EmployeeSelector';

import { SickLeavesConflictsDialog } from '../../containers/SickLeavesConflictsDialog/SickLeavesConflictsDialog';
import { LoadingDialog } from '../../containers/LoadingDialog/LoadingDialog';
import { AddSickLeavesDialog } from '../../containers/AddSickLeavesDialog/AddSickLeavesDialog';
import { ErrorDialog } from '../../containers/ErrorDialog/ErrorDialog';
import { DeleteSickLeaveDialog } from '../../containers/DeleteSickLeaveDialog/DeleteSickLeaveDialog';
import { findLocalTimezone } from '../../../common/helpers/moment-utils';

const { SubHeader, Caption, Text } = T;
const { Table, Row, Cell } = RedTable;

const getUserWithCalendars = createSelector(
  state =>
    state.globalStore
      .get('users')
      .filter(u => u.externalCalendars.revaCalendarId)
      .toArray(),
  res => res,
);

@connect(
  state => ({
    users: state.globalStore.get('users'),
    usersWithCalendars: getUserWithCalendars(state),
    sickLeaves: state.sickLeaves.sickLeaves,
    loading: state.sickLeaves.loading,
    timezone: findLocalTimezone(),
    isSavingSickLeave: state.sickLeaves.isSaving,
    isDeletingSickLeave: state.sickLeaves.isDeleting,
    saveSickLeaveError: state.sickLeaves.saveSickLeaveError,
    removeSickLeaveError: state.sickLeaves.removeSickLeaveError,
    newConflicts: state.sickLeaves.newConflicts,
  }),
  dispatch => bindActionCreators({ ...sickLeavesActions }, dispatch),
)
export default class SickLeaves extends Component {
  constructor(props) {
    super(props);
    this.state = { sickLeavesConflictsDialogOpen: false, deleteSickLeavesDialogOpen: false, sickLeavesToDelete: [] };
  }

  static propTypes = {
    users: PropTypes.object,
    sickLeaves: PropTypes.array,
    loading: PropTypes.bool,
    deleteIcon: PropTypes.string,
  };

  static defaultProps = {
    deleteIcon: 'delete',
  };

  handleAgentSelected = item => {
    const { loadSickLeaves, onAgentSelected, users, timezone, clearSickLeaves } = this.props;
    const selectedAgent = users.get(item.id);

    clearSickLeaves();
    loadSickLeaves(selectedAgent.id, timezone);
    onAgentSelected();

    this.setState({ selectedAgent });
    this.agentSelector.close();
  };

  renderSelectedAgent = () => {
    const { selectedAgent } = this.state;

    if (selectedAgent) {
      return (
        <div className={cf('agent-card')}>
          <Avatar userName={selectedAgent.fullName} src={selectedAgent.avatarUrl} />
          <div className={cf('agent-text')}>
            <SubHeader>{selectedAgent.fullName}</SubHeader>
            <Caption secondary>{getBusinessTitle(selectedAgent)}</Caption>
          </div>
        </div>
      );
    }

    return <SubHeader>{t('SELECT_A_LEASING_AGENT')}</SubHeader>;
  };

  openConflictsDialog = eventWithConflicts => {
    this.setState({ eventWithConflicts, sickLeavesConflictsDialogOpen: true });
  };

  renderEventData = event => {
    const conflictCount = event.conflictEvents.length;
    return (
      <div className={cf('sick-leave')}>
        <div className={cf('sick-leave-top')}>
          {event.day} - {event.dayOfWeek}, {event.isAllDay ? t('ALL_DAY_EVENT') : `${event.startHour} - ${event.endHour}`}
        </div>
        {(conflictCount || event.notes) && (
          <div className={cf('sick-leave-bottom')}>
            {!!conflictCount && (
              <Button
                className={cf('conflicts-button')}
                label={<Text className={cf('conflicts-link')}>{t('RESOLVE_CONFLICTS', { count: conflictCount })}</Text>}
                type="flat"
                btnRole="secondary"
                onClick={() => this.openConflictsDialog(event)}
              />
            )}
            <T.Caption secondary>{event.notes}</T.Caption>
          </div>
        )}
      </div>
    );
  };

  renderSickLeavesRows = () => {
    const sickLeaveList = this.props.sickLeaves;

    if (!sickLeaveList.length) {
      return <Text>{t('NO_SICK_LEAVES_AVAILABLE')}</Text>;
    }

    return sickLeaveList.map(sickLeave => (
      <Row key={`sickleave-${sickLeave.id}-${sickLeave.day}`} className={cf('row')} width="30em">
        {this.renderEventData(sickLeave)}
        <Cell width="10%" textAlign="center" key={`c-${sickLeave.id}-btn`}>
          <IconButton iconName={this.props.deleteIcon} onClick={() => this.onToggleShowDeleteSickLeavesDialog(true, sickLeave.id)} />
        </Cell>
      </Row>
    ));
  };

  addSickLeave = sickLeave => {
    const { addSickLeave, closeAddSickLeaveDialog } = this.props;

    addSickLeave(sickLeave);
    closeAddSickLeaveDialog();
  };

  handleCloseErrorDialog = () => {
    this.props.clearError();
  };

  onToggleShowDeleteSickLeavesDialog = (deleteSickLeavesDialogOpen, sickLeaveToDeleteId) => {
    const sickLeavesToDelete = this.props.sickLeaves.filter(sickLeave => sickLeave.id === sickLeaveToDeleteId);
    this.setState({ deleteSickLeavesDialogOpen, sickLeavesToDelete });
  };

  onHandleSickLeaveDelete = () => {
    const sickLeaveToDeleteId = this.state.sickLeavesToDelete[0]?.id;
    this.props.removeSickLeave(sickLeaveToDeleteId);
    this.onToggleShowDeleteSickLeavesDialog(false);
  };

  closeConflictsDialog = () => {
    this.setState({ eventWithConflicts: null, sickLeavesConflictsDialogOpen: false });
    this.props.clearNewConflicts();
  };

  isConflictDialogOpen = () => this.state.sickLeavesConflictsDialogOpen || !!this.props.newConflicts?.length;

  getErrorDialogLabel = () =>
    this.props.saveSickLeaveError ? t('FAILED_TO_ADD_EVENT_TO_EXTERNAL_CALENDAR') : t('FAILED_TO_REMOVE_EVENT_FROM_EXTERNAL_CALENDAR');

  getLoadingDialogLabel = () => {
    const key = this.props.isSavingSickLeave ? 'ADDING_SICK_LEAVE_LOADING' : 'REMOVING_SICK_LEAVE_LOADING';
    return t(key, { agentName: this.state.selectedAgent?.fullName });
  };

  render = () => {
    const { selectedAgent, eventWithConflicts, deleteSickLeavesDialogOpen, sickLeavesToDelete } = this.state;
    const { closeAddSickLeaveDialog, isSavingSickLeave, isDeletingSickLeave, saveSickLeaveError, removeSickLeaveError, newConflicts } = this.props;
    const conflictEvents = eventWithConflicts?.conflictEvents || newConflicts;
    const isErrorDialogOpen = saveSickLeaveError || removeSickLeaveError;
    const isLoadingDialogOpen = isSavingSickLeave || isDeletingSickLeave;
    const errorLabel = this.getErrorDialogLabel();
    const loadingLabel = this.getLoadingDialogLabel();

    return (
      <div className={cf('container')}>
        <FlyOut ref={ref => (this.agentSelector = ref)} overTrigger expandTo="bottom-right">
          <Button type="wrapper" className={cf('agents-button')}>
            {this.renderSelectedAgent()}
            <span className={cf('icon-wrapper')}>
              <Icon name="menu-down" />
            </span>
          </Button>
          <FlyOutOverlay animationFn={handleFlyoutAnimation} container={false} elevation={2}>
            <EmployeeSelector users={this.props.usersWithCalendars} onEmployeeSelected={this.handleAgentSelected} placeholderText={t('FIND')} noStatusBadge />
          </FlyOutOverlay>
        </FlyOut>
        {selectedAgent && (
          <div className={cf('container')}>
            <Table className={cf('table')} type="readOnly">
              {this.renderSickLeavesRows()}
            </Table>
          </div>
        )}
        <SickLeavesConflictsDialog
          id="sickLeavesConflictsDialog"
          open={this.isConflictDialogOpen()}
          closeOnEscape={this.state.PropertySelectionCloseOnEscape}
          selectedAgent={selectedAgent}
          conflictEvents={conflictEvents}
          onClose={this.closeConflictsDialog}
        />
        <AddSickLeavesDialog
          id="addSickLeavesDialog"
          open={this.props.addSickLeaveDialogOpen}
          selectedAgent={selectedAgent}
          onClose={closeAddSickLeaveDialog}
          onSave={this.addSickLeave}
          showCancelButton={false}
        />
        <LoadingDialog open={isLoadingDialogOpen} label={loadingLabel} />
        <ErrorDialog open={isErrorDialogOpen} label={errorLabel} onClose={() => this.handleCloseErrorDialog()} />
        <DeleteSickLeaveDialog
          open={deleteSickLeavesDialogOpen}
          sickLeavesToDelete={sickLeavesToDelete}
          onClose={() => this.onToggleShowDeleteSickLeavesDialog(false)}
          onDelete={() => this.onHandleSickLeaveDelete()}
        />
      </div>
    );
  };
}
