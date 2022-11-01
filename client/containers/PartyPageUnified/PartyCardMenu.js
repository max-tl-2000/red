/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import * as CM from 'components/CardMenu/CardMenuIndex';
import { t } from 'i18next';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { observer } from 'mobx-react';
import {
  isPartyClosed,
  isPartyNotActive,
  partyIsMerged,
  canCloseParty,
  partyHaveBlockedContacts,
  canBeMarkedAsSpam,
  getPersonsInPartyFlags,
  getPartyMembers,
  getFlagShouldReviewMatches,
  partyHasPreviouslyBlockedContacts,
  getCommunications,
} from 'redux/selectors/partySelectors';
import {
  isUserARevaAdmin,
  isDuplicatePersonNotificationEnabled,
  canMergeParties,
  areNativeCommsEnabled,
  canUserBlockContact,
  isAuditorUser,
} from 'redux/selectors/userSelectors';
import DemoElement from 'custom-components/DemoElement/DemoElement';
import { reopenParty, exportParty, updateParty, enablePartyCai, activatePaymentPlan, addTransferReasonActivityLogAndComm } from 'redux/modules/partyStore';
import { markCommsAsReadForParty } from 'redux/modules/communication';

import { WALK_IN } from 'helpers/comm-flyout-types';
import { startAddingAppointment } from 'redux/modules/appointments.dialog';
import { startAddingTask, closeTaskDialog } from 'redux/modules/tasks';
import { importAndProcessWorkflows, clearImportAndProcessWorkflow } from 'redux/modules/tenantsStore';
import { openMergePartyFlyout } from 'redux/modules/mergePartiesStore';
import { isLoggedAsAdmin } from 'helpers/users';
import { DALTypes } from '../../../common/enums/DALTypes';
import ManualTaskDialog from '../ManualTaskDialog/ManualTaskDialog';
import ActivityLogDialog from './ActivityLogDialog';
import PartyGroupDialog from './PartyGroupDialog';
import ClosePartyDialogWrapper from './ClosePartyDialogWrapper';
import DialogModel from './DialogModel';
import ClosePartyAsReasonWrapper, { closeReasonsHash } from './ClosePartyAsReasonWrapper';
import BlockContactDialogWrapper from './BlockContactDialogWrapper';
import TransferLeaseDialog from './TransferLeaseDialog';
import ImportAndProcessWorkflowsDialog from '../Tenants/ImportAndProcessWorkflowsDialog';
import { MERGE_DIALOG_OPENED_FROM_TYPE } from '../../helpers/party';
import { PropertySelectionDialog } from '../PropertySelection/PropertySelectionDialog';
import { getTranferPartyDialogData } from '../../../common/helpers/transferDialog-utils';
import TransferPartyDialog from '../TransferPartyDialog/TransferPartyDialog.js';
@connect(
  (state, props) => ({
    showBlockContactOption: canUserBlockContact(state, props),
    isClosed: isPartyClosed(state, props),
    partyNotActive: isPartyNotActive(state, props),
    partyHasUnreadComms: getCommunications(state, props).some(it => it.unread),
    showRevaAdminOptions: isUserARevaAdmin(state, props),
    commFlags: getPersonsInPartyFlags(state, props),
    nativeCommsEnabled: areNativeCommsEnabled(state, props),
    shouldShowReviewDuplicateOptions: getFlagShouldReviewMatches(state, props),
    displayDuplicatePersonNotification: isDuplicatePersonNotificationEnabled(state, props),
    partyHaveBlockedContacts: partyHaveBlockedContacts(state, props),
    partyIsMerged: partyIsMerged(state, props),
    partyCanBeClosed: canCloseParty(state, props),
    isMergedPartyEnabled: canMergeParties(state, props),
    canBeMarkedAsSpam: canBeMarkedAsSpam(state, props),
    partyMembers: getPartyMembers(state, props),
    isAddingAppointment: state.appointmentsDialog.isEnabled,
    showAddTaskDialog: state.tasks.isEnabled,
    currentUser: state.auth.user,
    selectorDataForParty: state.partyStore.selectorDataForParty,
    partyHasPreviouslyBlockedContacts: partyHasPreviouslyBlockedContacts(state, props),
    isJobLoading: state.tenants.isJobLoading,
    finished: state.tenants.finished,
    processStatus: state.tenants.processStatus,
    showAuditorOptions: isAuditorUser(state, props),
    users: state.globalStore.get('users'),
    loggedInUser: state.auth.user,
    isOpen: state.mergePartiesStore.isFlyoutOpen,
  }),
  dispatch =>
    bindActionCreators(
      {
        reopenParty,
        openMergePartyFlyout,
        startAddingAppointment,
        startAddingTask,
        closeTaskDialog,
        exportParty,
        updateParty,
        enablePartyCai,
        markCommsAsReadForParty,
        importAndProcessWorkflows,
        clearImportAndProcessWorkflow,
        activatePaymentPlan,
        addTransferReasonActivityLogAndComm,
      },
      dispatch,
    ),
)
@observer
export default class PartyCardMenu extends Component {
  constructor(props) {
    super(props);

    this.state = {
      closeAsResident: new DialogModel(),
      contactBlockedPreviouslyDialog: new DialogModel(),
      activityDialog: new DialogModel(),
      partyGroupDialog: new DialogModel(),
      closeParty: new DialogModel(),
      markSAsSpam: new DialogModel(),
      transferLeaseDialog: new DialogModel(),
      importAndProcessWorkflow: new DialogModel(),
      PropertySelectionDialogOpen: false,
      showPropertySelectionCancelBtn: false,
      PropertySelectionCloseOnEscape: true,
      showTranferPartyDialog: false,
      transferPartyDialogContent: '',
    };
  }

  get cannotReopenParty() {
    const { partyHaveBlockedContacts: haveBlockedContacts, partyIsMerged: partyIsMergedAlready } = this.props;

    return partyIsMergedAlready || haveBlockedContacts;
  }

  get isMarkAsSpamDisabled() {
    const { partyHaveBlockedContacts: haveBlockedContacts, canBeMarkedAsSpam: canMarkPartyAsSpam } = this.props;
    return haveBlockedContacts || !canMarkPartyAsSpam;
  }

  handleShowWalkinFlyout = () => {
    const { openCommFlyOut } = this.props;

    openCommFlyOut && openCommFlyOut({ flyoutType: WALK_IN });
  };

  get canClosePartyAsResident() {
    const { partyCanBeClosed, partyMembers } = this.props;
    return partyCanBeClosed && partyMembers.size === 1;
  }

  openAddAppointmentDialog = () => {
    const { partyId, startAddingAppointment: doAddAppointment } = this.props;

    doAddAppointment(partyId);
  };

  openAddTaskFlyOut = () => {
    const { startAddingTask: addTask } = this.props;
    addTask();
  };

  handleMergePartyDialogOpenFromMenu = () => {
    const { props } = this;
    const { partyId } = props;
    const mergeContext = DALTypes.MergePartyContext.PARTY;

    props.openMergePartyFlyout({
      partyId,
      mergeContext,
      openedFrom: MERGE_DIALOG_OPENED_FROM_TYPE.FROM_PARTY_CARD,
    });
  };

  handleMarkAsSpam = () => {
    const { canBlockContact, isMarkAsSpamDisabled, state, props } = this;
    if (!canBlockContact || isMarkAsSpamDisabled) return;

    if (props.partyHasPreviouslyBlockedContacts) {
      state.contactBlockedPreviouslyDialog.open();
      return;
    }

    state.markSAsSpam.open();
  };

  handleMarkCommsAsRead = () => {
    const { props } = this;
    props.markCommsAsReadForParty(props.partyId);
  };

  componentWillUnmount() {
    const { props } = this;
    props.closeTaskDialog();
  }

  handleExportParty = (isAuditor = false) => {
    const { props } = this;
    props.exportParty(props.partyId, isAuditor);
  };

  handlePartyCai = () => {
    const { props } = this;
    const { caiEnabled = false } = props.party?.metadata || {};
    props.enablePartyCai(props.partyId, !caiEnabled);
  };

  get canBlockContact() {
    const { showRevaAdminOptions, showBlockContactOption } = this.props;
    return showRevaAdminOptions || showBlockContactOption;
  }

  get shouldShowAddTaskDialog() {
    const { partyId, showAddTaskDialog } = this.props;
    return partyId && showAddTaskDialog;
  }

  get showMergePartiesMenuItem() {
    const { partyNotActive, isMergedPartyEnabled, isRenewal } = this.props;
    return !partyNotActive && isMergedPartyEnabled && !isRenewal;
  }

  get showImportAndProcessWorkflowItem() {
    const { showRevaAdminOptions } = this.props;
    return showRevaAdminOptions;
  }

  get importEnabled() {
    const { currentUser, property } = this.props;
    const isMRIBackend = currentUser?.backendName === DALTypes.BackendMode.MRI;
    const isImportResidentDataOn = property?.settings?.integration?.import?.residentData;
    return isMRIBackend && isImportResidentDataOn;
  }

  handleImportAndProcessWorkflows = ({ skipImport, skipProcess }) => {
    const { currentUser, property, party, finished } = this.props;
    const tenantId = currentUser?.tenantId;
    const propertyExternalId = property?.externalId;
    const partyGroupId = party?.partyGroupId;

    !finished &&
      this.props.importAndProcessWorkflows &&
      this.props.importAndProcessWorkflows({ tenantId, skipImport, skipProcess, propertyExternalId, partyGroupId, waitForResponse: true });
  };

  closeImportAndProcessWfDialog = () => {
    this.props.clearImportAndProcessWorkflow && this.props.clearImportAndProcessWorkflow();
    this.state.importAndProcessWorkflow.close();
  };

  handleActivatePaymentPlan = async () => await this.props.activatePaymentPlan(this.props.partyId);

  handleTransferLeaseSelection = isTransferLease => {
    const { partyId } = this.props;

    this.props.updateParty({
      id: partyId,
      isTransferLease,
    });
  };

  handlePropertySelectionDialog = (showDialog, closeOnEscape = true, showPropertySelectionCancelBtn = false) =>
    this.setState({ PropertySelectionDialogOpen: showDialog, PropertySelectionCloseOnEscape: closeOnEscape, showPropertySelectionCancelBtn });

  handleSubmitPropertySelection = async ({ assignedPropertyId, ownerTeamId }) => {
    const {
      party,
      selectorDataForParty: { allTeams },
    } = this.props;
    const shouldTriggerMergeParties = assignedPropertyId !== this.props.party.assignedPropertyId;
    await this.props.updateParty({ id: this.props.partyId, assignedPropertyId, ownerTeam: ownerTeamId });
    this.handlePropertySelectionDialog(false);
    const previsiousItemAssociatedProperties = allTeams.find(team => team.id === party.ownerTeam)?.associatedProperties;
    const selectedItemAssociatedProperties = allTeams.find(team => team.id === ownerTeamId)?.associatedProperties;
    const transferDialogData = getTranferPartyDialogData({
      partyInfo: { ownerTeam: party.ownerTeam, assignedPropertyId: party.assignedPropertyId },
      selectedItem: { isTeam: true, id: ownerTeamId, associatedProperties: selectedItemAssociatedProperties, propertyId: assignedPropertyId },
      previsiousItemAssociatedProperties,
      allTeams,
    });
    this.setState({
      showTranferPartyDialog: transferDialogData.showDialog,
      transferPartyDialogContent: transferDialogData.content,
    });
    if (shouldTriggerMergeParties) {
      this.props.handleMergeParties({ propertyId: assignedPropertyId, oldPropertyId: this.props.party.assignedPropertyId });
    }
  };

  cancelTransferPartyDialog = () => this.setState({ showTranferPartyDialog: false, transferPartyDialogContent: '' });

  handleAddTransferPartyReason = async ({ reassignReason }) => {
    await this.props.addTransferReasonActivityLogAndComm(this.props.party, reassignReason);
    this.setState({ showTranferPartyDialog: false, transferPartyDialogContent: '' });
  };

  matcherFunction({ resource }) {
    return resource.match(/_\/parties\//);
  }

  render() {
    const {
      props,
      handleShowWalkinFlyout,
      openAddAppointmentDialog,
      cannotReopenParty,
      canClosePartyAsResident,
      canBlockContact,
      shouldShowAddTaskDialog,
      isMarkAsSpamDisabled,
      openAddTaskFlyOut,
      importEnabled,
      showImportAndProcessWorkflowItem,
      handleMergePartyDialogOpenFromMenu,
      handleExportParty,
      state,
    } = this;
    const { PropertySelectionDialogOpen, showTranferPartyDialog } = state;
    const {
      partyId,
      party,
      isClosed,
      partyNotActive,
      partyHasUnreadComms,
      nativeCommsEnabled,
      partyCanBeClosed,
      selectorDataForParty,
      onReviewMatchRequest,
      partyMembers,
      partyStateIsNotContact,
      shouldShowReviewDuplicateOptions,
      showRevaAdminOptions,
      leaseNotExecuted,
      property,
      isJobLoading,
      finished,
      processStatus,
      showAuditorOptions,
      loggedInUser,
      users,
      partyClosedOrArchived,
    } = props;

    const user = users.get(loggedInUser.id);
    const isNewLease = party?.workflowName === DALTypes.WorkflowName.NEW_LEASE;
    const isImportResidentDataOn = property?.settings?.integration?.import?.residentData;
    const { caiEnabled = false } = party?.metadata || {};
    const shouldRenderCloseButton = isNewLease || showRevaAdminOptions;
    const isPaymentPlanFeatureEnabled = this.props.currentUser?.features?.enablePaymentPlan;
    return (
      <span>
        <CM.CardMenu triggerProps={{ id: 'partyCardMenu' }} iconName="dots-vertical" iconStyle="light" disabled={!partyId}>
          <CM.Item
            data-id="scheduleAppointment"
            text={t('DASHBOARD_MENU_SCHEDULE_APPOINTMENT')}
            onClick={() => openAddAppointmentDialog(false)}
            disabled={partyNotActive}
          />
          {nativeCommsEnabled && (
            <CM.Item data-id="addPriorActivityItem" text={t('ADD_CONTACT_ACTIVITY')} onClick={handleShowWalkinFlyout} disabled={partyNotActive} />
          )}
          <CM.Item data-id="addTaskItem" text={t('BUTTON_ADD_TASK')} onClick={openAddTaskFlyOut} disabled={partyNotActive} />

          <CM.Divider />

          {/* TODO: Couldn't find how to test this option. Ask team about this one */}
          {shouldShowReviewDuplicateOptions && <CM.Item text={t('REVIEW_DUPLICATES')} onClick={onReviewMatchRequest} disabled={partyNotActive} />}
          {shouldShowReviewDuplicateOptions && <CM.Divider />}

          <CM.Item data-id="viewActivityLogItem" text={t('BUTTON_VIEW_ACTIVITY_LOGS')} onClick={state.activityDialog.open} />
          <CM.Item data-id="viewAllWorkflowsItem" text={t('BUTTON_VIEW_ALL_WORKFLOWS')} onClick={state.partyGroupDialog.open} />
          {partyStateIsNotContact && <CM.Item data-id="exportPartyFileItem" text={t('BUTTON_EXPORT_PARTY')} onClick={() => handleExportParty(false)} />}
          {partyStateIsNotContact && showAuditorOptions && (
            <CM.Item data-id="auditPartyFile" text={t('BUTTON_AUDIT_PARTY')} onClick={() => handleExportParty(true)} />
          )}
          <DemoElement>
            <CM.Item text={t(caiEnabled ? 'BUTTON_DISABLE_AI' : 'BUTTON_ENABLE_AI')} onClick={this.handlePartyCai} />
          </DemoElement>
          {isClosed && <CM.Item text={t('REOPEN_PARTY')} disabled={cannotReopenParty} onClick={() => props.onReopenPartyReqeuest(partyId)} />}
          {isNewLease && !partyNotActive && !isImportResidentDataOn && (
            <CM.Item text={t('CLOSE_AS_RESIDENT')} onClick={state.closeAsResident.open} disabled={!canClosePartyAsResident} />
          )}
          {shouldRenderCloseButton && !partyNotActive && (
            <CM.Item data-id="closePartyItem" text={t('BUTTON_CLOSE_PARTY')} onClick={state.closeParty.open} disabled={!partyCanBeClosed} />
          )}
          {this.showMergePartiesMenuItem && (
            <CM.Item data-id="mergePartiesItem" text={t('MERGE_PARTIES_LABEL')} onClick={handleMergePartyDialogOpenFromMenu} disabled={!party} />
          )}
          {canBlockContact && <CM.Divider />}
          {canBlockContact && <CM.Item text={t('MARK_AS_SPAM')} onClick={this.handleMarkAsSpam} disabled={isMarkAsSpamDisabled} />}
          {showRevaAdminOptions && <CM.Item text={t('TRANSFER_LEASE')} onClick={state.transferLeaseDialog.open} disabled={partyNotActive} />}
          <CM.Item text={t('MARK_COMMS_AS_READ')} onClick={this.handleMarkCommsAsRead} disabled={!partyHasUnreadComms} />
          {showImportAndProcessWorkflowItem && (
            <CM.Item data-id="importAndProcessWorkflowItem" text={t('IMPORT_AND_PROCESS_WORKFLOWS')} onClick={state.importAndProcessWorkflow.open} />
          )}
          {isPaymentPlanFeatureEnabled && !party?.metadata?.activatePaymentPlanDate && (
            <CM.Item text={t('ACTIVATE_PAYMENT_PLAN')} onClick={this.handleActivatePaymentPlan} />
          )}
          {isLoggedAsAdmin(user) && (
            <CM.Item
              id="changePropertyMenuItem"
              text={t('CHANGE_PRIMARY_PROPERTY')}
              onClick={() => this.handlePropertySelectionDialog(true, true, true)}
              disabled={partyClosedOrArchived}
            />
          )}
        </CM.CardMenu>
        {partyId && <ClosePartyAsReasonWrapper partyId={partyId} model={state.closeAsResident} reason={closeReasonsHash.alreadeAResident} />}
        {partyId && <ClosePartyAsReasonWrapper partyId={partyId} model={state.contactBlockedPreviouslyDialog} reason={closeReasonsHash.markedAsSpam} />}
        {partyId && <ClosePartyDialogWrapper partyId={partyId} model={state.closeParty} leaseNotExecuted={leaseNotExecuted} property={property} />}
        {shouldShowAddTaskDialog && (
          <ManualTaskDialog partyId={partyId} selectorData={selectorDataForParty} partyOwnerId={party.userId} ownerTeamId={party.ownerTeam} />
        )}
        {partyId && <ActivityLogDialog partyId={partyId} model={state.activityDialog} />}
        {partyId && <PartyGroupDialog partyGroupId={party?.partyGroupId} model={state.partyGroupDialog} />}
        {partyId && <BlockContactDialogWrapper model={state.markSAsSpam} party={party} partyMembers={partyMembers} />}
        {partyId && showRevaAdminOptions && (
          <TransferLeaseDialog model={state.transferLeaseDialog} party={party} onTransferClick={this.handleTransferLeaseSelection} />
        )}
        {partyId && state.importAndProcessWorkflow.isOpen && (
          <ImportAndProcessWorkflowsDialog
            open={state.importAndProcessWorkflow.isOpen}
            enableImport={importEnabled}
            onOKClick={this.handleImportAndProcessWorkflows}
            onClose={this.closeImportAndProcessWfDialog}
            hideNotes
            propertyExternalId={property?.externalId}
            waitForResponse
            isJobLoading={isJobLoading}
            finished={finished}
            processStatus={processStatus}
          />
        )}
        {PropertySelectionDialogOpen && (
          <PropertySelectionDialog
            id="propertySelectionDialog"
            open={PropertySelectionDialogOpen}
            onSubmit={this.handleSubmitPropertySelection}
            closeOnEscape={this.state.PropertySelectionCloseOnEscape}
            onClose={() => this.handlePropertySelectionDialog(false)}
            propertyId={party?.assignedPropertyId}
            properties={user?.associatedProperties}
            teamId={party?.ownerTeam}
            teams={user?.teams}
            party={party}
            showCancelButton={this.state.showPropertySelectionCancelBtn}
            displayPartyCohort={true}
          />
        )}
        {showTranferPartyDialog && !this.props.isOpen && (
          <TransferPartyDialog
            open={showTranferPartyDialog}
            transferPartyDialogContent={this.state.transferPartyDialogContent}
            handleOnSubmit={this.handleAddTransferPartyReason}
            cancelTransferPartyDialog={this.cancelTransferPartyDialog}
          />
        )}
      </span>
    );
  }
}
