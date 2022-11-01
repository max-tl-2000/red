/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { Section, FlyOut, IconButton, FlyOutOverlay } from 'components';
import { canModifyParty, getSalesPersonsInParty, getUsersLastActivity, getPartyEnhancedAppointments } from 'redux/selectors/partySelectors';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import snackbar from 'helpers/snackbar/snackbar';
import { getAlreadyPrimaryAgentMessage } from 'helpers/party';
import { observer } from 'mobx-react';
import { observable, action } from 'mobx';
import { assignParty, loadSelectorDataForParty, clearAssignPartyError } from 'redux/modules/partyStore';
import SalesPersonList from '../ProspectDetailPage/LeasingTeam/SalesPersonList';
import EmployeeSelector from '../Dashboard/EmployeeSelector';
import AssignPartyAppointmentConflictDialog from '../ProspectDetailPage/AssignPartyAppointmentConflictDialog';
import { isRevaAdmin } from '../../../common/helpers/auth';
import TransferPartyDialog from '../TransferPartyDialog/TransferPartyDialog';
import { getTranferPartyDialogData } from '../../../common/helpers/transferDialog-utils';

@connect(
  (state, props) => ({
    selectorDataForParty: state.partyStore.selectorDataForParty,
    salesPersonList: getSalesPersonsInParty(state, props),
    usersLastActivity: getUsersLastActivity(state, props),
    assignPartyError: state.partyStore.assignPartyError,
    currentUserId: (state.auth.user || {}).id,
    currentUser: state.auth.user,
    users: state.globalStore.get('users'),
    appointments: getPartyEnhancedAppointments(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        assignParty,
        loadSelectorDataForParty,
        clearAssignPartyError,
      },
      dispatch,
    ),
)
@observer
export default class SalesPersonListWrapper extends Component {
  constructor(props) {
    super(props);

    this.state = {
      showTranferPartyDialog: false,
      transferPartyDialogContent: '',
    };
  }

  @observable.shallow
  selectedPartyAssignee;

  @action
  doAssignParty = ({ checkConflictingAppointments, reassignReason }) => {
    const { selectedPartyAssignee, props } = this;
    if (!selectedPartyAssignee) return;

    const { party, currentUserId, currentUser, users, onPartyReassign } = props;
    const { isTeam, id, userId, teamId, fullName } = selectedPartyAssignee;

    const assignTo = isTeam ? { teamId: id } : { userId, teamId };

    const isCurrentUser = userId === currentUserId;
    const alreadyOwner = assignTo.userId && assignTo.userId === party.userId && assignTo.teamId === party.ownerTeam;

    if (alreadyOwner) {
      snackbar.show({ text: getAlreadyPrimaryAgentMessage(isCurrentUser, fullName) });
    } else {
      onPartyReassign && onPartyReassign();
      props.assignParty(party.id, assignTo, isCurrentUser, fullName, checkConflictingAppointments, reassignReason);
      props.loadSelectorDataForParty(users, currentUser, party);
    }
  };

  get assignPartyError() {
    return this.props.assignPartyError || {};
  }

  get partyHasAssignPartyError() {
    const { assignPartyError } = this;
    return assignPartyError.token === 'APPOINTMENTS_CONFLICT';
  }

  @action
  handleOnAssignParty = selectedItem => {
    const {
      party,
      salesPersonList,
      selectorDataForParty: { allTeams },
    } = this.props;
    const primaryAgent = salesPersonList[0];
    this.employeeSelectorFlyout.close();

    const transferDialogData = getTranferPartyDialogData({
      partyInfo: { ownerTeam: party.ownerTeam, assignedPropertyId: party.assignedPropertyId },
      selectedItem,
      previsiousItemAssociatedProperties: primaryAgent?.associatedProperties,
      allTeams,
    });

    this.setState({
      showTranferPartyDialog: transferDialogData.showDialog,
      transferPartyDialogContent: transferDialogData.content,
    });

    this.selectedPartyAssignee = selectedItem;
    !this.state.showTranferPartyDialog && this.doAssignParty({ checkConflictingAppointments: true });
  };

  storeRef = ref => {
    this.employeeSelectorFlyout = ref;
  };

  cancelTransferPartyDialog = () => this.setState({ showTranferPartyDialog: false, transferPartyDialogContent: '' });

  render() {
    const { selectorDataForParty, salesPersonList, usersLastActivity, party, appointments, timezone, currentUser } = this.props;
    const { showTranferPartyDialog, transferPartyDialogContent } = this.state;
    if (!salesPersonList) return null;
    const isCurrentUserRevaAdmin = isRevaAdmin(currentUser);
    const salesPersonListWithoutRevaAdmin = salesPersonList.filter(salesPerson => !isRevaAdmin(salesPerson));

    return (
      <div>
        <Section
          title={t('LEASING_TEAM_LABEL')}
          data-id="participantsSection"
          actionItems={
            canModifyParty && (
              <FlyOut ref={this.storeRef} expandTo="top-left" overTrigger>
                <IconButton iconName="change-owner" />
                <FlyOutOverlay container={false} elevation={2}>
                  <EmployeeSelector
                    suggestedUsers={selectorDataForParty.users}
                    suggestedTeams={selectorDataForParty.teams}
                    users={selectorDataForParty.allUsers}
                    teams={selectorDataForParty.allTeams}
                    currentUser={currentUser}
                    onEmployeeSelected={this.handleOnAssignParty}
                    placeholderText={t('FIND_MORE')}
                  />
                </FlyOutOverlay>
              </FlyOut>
            )
          }>
          <SalesPersonList
            users={isCurrentUserRevaAdmin ? salesPersonList : salesPersonListWithoutRevaAdmin}
            activityLogs={usersLastActivity}
            timezone={timezone}
          />
        </Section>
        {this.partyHasAssignPartyError && (
          <AssignPartyAppointmentConflictDialog
            open={this.partyHasAssignPartyError}
            onClose={() => {
              this.props.clearAssignPartyError();
            }}
            onOverbookRequest={this.doAssignParty}
            selectedPartyAssignee={this.selectedPartyAssignee}
            conflictingAppointmentIds={this.assignPartyError?.data?.appointmentIds}
            appointments={appointments}
            partyOwnerId={party.userId}
            timezone={timezone}
          />
        )}
        {showTranferPartyDialog && (
          <TransferPartyDialog
            open={showTranferPartyDialog}
            transferPartyDialogContent={transferPartyDialogContent}
            handleOnSubmit={this.doAssignParty}
            cancelTransferPartyDialog={this.cancelTransferPartyDialog}
          />
        )}
      </div>
    );
  }
}
