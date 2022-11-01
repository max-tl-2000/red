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
import { getPartyStateToDisplay } from 'helpers/party';
import { t } from 'i18next';
import { fetchPartyMatch, clearSession, closeMergePartyFlyout, doNotMerge, merge, clearAppointmentsError } from 'redux/modules/mergePartiesStore';
import { addTransferReasonActivityLogAndComm } from 'redux/modules/partyStore';
import { formatDateAgo } from 'helpers/date-utils';
import {
  MsgBox,
  Button,
  Icon,
  PreloaderBlock,
  Dialog,
  DialogOverlay,
  DialogActions,
  FlyOut,
  FlyOutOverlay,
  Divider,
  RedList,
  Avatar,
  Typography,
} from 'components';
import { observer, inject } from 'mobx-react';
import { DALTypes } from '../../../common/enums/DALTypes';
import { MERGE_DIALOG_OPENED_FROM_TYPE, getMergeDialogTitle, getMergeDialogBody } from '../../helpers/party';
import EmployeeSelector from '../Dashboard/EmployeeSelector';
import EmployeeCard from '../Dashboard/EmployeeCard';
import AssignPartyAppointmentConflictDialog from '../ProspectDetailPage/AssignPartyAppointmentConflictDialog';
import TransferPartyDialog from '../TransferPartyDialog/TransferPartyDialog';
import { getTranferPartyDialogData } from '../../../common/helpers/transferDialog-utils';

import { cf } from './MergePartyDialog.scss';
import { getDisplayName } from '../../../common/helpers/person-helper';

const { List, ListItem, MainSection, AvatarSection, TextTitle } = RedList;

const { Text, Caption } = Typography;

@connect(
  state => ({
    isLoading: state.mergePartiesStore.isLoading,
    isOpen: state.mergePartiesStore.isFlyoutOpen,
    error: state.mergePartiesStore.error,
    mergePartiesData: state.mergePartiesStore.mergePartiesData,
    sessionId: state.mergePartiesStore.sessionId,
    mergeContext: state.mergePartiesStore.mergeContext,
    mergeResult: state.mergePartiesStore.mergeResult,
    appointmentsConflictData: state.mergePartiesStore.appointmentsConflictData,
    loggedInUser: state.auth.user,
    openedFrom: state.mergePartiesStore.openedFrom,
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchPartyMatch,
        clearSession,
        closeMergePartyFlyout,
        doNotMerge,
        merge,
        clearAppointmentsError,
        addTransferReasonActivityLogAndComm,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class MergePartyDialog extends Component {
  static propTypes = {
    selectorData: PropTypes.object.isRequired,
    properties: PropTypes.array.isRequired,
    fetchPartyMatch: PropTypes.func.isRequired,
    clearSession: PropTypes.func.isRequired,
    closeMergePartyFlyout: PropTypes.func.isRequired,
    doNotMerge: PropTypes.func.isRequired,
    merge: PropTypes.func.isRequired,
    addTransferReasonActivityLogAndComm: PropTypes.func,
    skipRedirect: PropTypes.bool,
    appointmentsConflictData: PropTypes.object,
    timezone: PropTypes.string,
  };

  constructor(props) {
    super(props);

    this.state = {
      leasingAgent: null,
      agentTeamId: null,
      property: {},
      selectedProperty: null,
      showTranferPartyDialog: false,
      transferPartyDialogContent: '',
      transerPartyInfo: {},
    };
  }

  componentWillReceiveProps(nextProps) {
    const { properties, mergePartiesData } = nextProps;
    const firstParty = mergePartiesData?.firstParty;
    if (firstParty && mergePartiesData !== this.props.mergePartiesData) {
      this.setState({ property: properties.find(p => p.id === firstParty.assignedPropertyId) });
    }
  }

  handleLeasingAgentChange = ({ userId, teamId }) => {
    this.refs.employeeSelectorFlyout.close();
    this.setState({
      leasingAgent: this.getLeasingAgent(userId),
      agentTeamId: teamId,
    });
  };

  handleDoNotMergeParty = async () => {
    const openedFromDoNotMergeButton = MERGE_DIALOG_OPENED_FROM_TYPE.FROM_DONT_MERGE_BUTTON;
    await this.props.doNotMerge(this.props.sessionId, this.props.mergePartiesData.matchId, openedFromDoNotMergeButton);
    await this.props.fetchPartyMatch(this.props.sessionId);
  };

  redirectToResultParty = resultPartyId => {
    if (this.props.skipRedirect) return;
    const { leasingNavigator, personId } = this.props;
    const options = personId ? { openMergeParties: true, personId } : {};

    leasingNavigator.navigateToParty(resultPartyId, options);
  };

  handleMergeParty = async shouldCheckConflictingAppointments => {
    const { leasingAgent, agentTeamId, selectedProperty } = this.state;
    const {
      sessionId,
      mergePartiesData: { firstParty, matchId },
      selectorData: { allUsers, allTeams },
    } = this.props;
    const previsiousItemAssociatedProperties = allUsers.find(user => user.id === firstParty.userId)?.associatedProperties;
    const transferDialogData = getTranferPartyDialogData({
      partyInfo: { ownerTeam: firstParty.ownerTeam, assignedPropertyId: firstParty.assignedPropertyId },
      selectedItem: {
        isTeam: leasingAgent?.isTeam,
        id: leasingAgent.id,
        teamId: agentTeamId,
        associatedProperties: leasingAgent.associatedProperties,
        propertyId: selectedProperty?.id,
      },
      previsiousItemAssociatedProperties,
      allTeams,
    });

    this.setState({
      showTranferPartyDialog: transferDialogData.showDialog,
      transferPartyDialogContent: transferDialogData.content,
      transerPartyInfo: firstParty,
    });

    const success = await this.props.merge({
      sessionId,
      matchId,
      partyOwnerId: leasingAgent.id,
      ownerTeamId: agentTeamId,
      shouldCheckConflictingAppointments,
      chosenProperty: selectedProperty,
      openedFrom: MERGE_DIALOG_OPENED_FROM_TYPE.FROM_MERGE_PARTY,
    });
    if (!success) return;
    const {
      mergeResult: { resultPartyId },
    } = this.props;

    this.props.fetchPartyMatch(sessionId);
    this.redirectToResultParty(resultPartyId);
    this.setState({ leasingAgent: null, selectedProperty: null, agentTeamId: null });
  };

  renderLabelWithValue = (oneLabel, manyLabel, count) => <Text>{t(count === 1 ? oneLabel : manyLabel, { count })}</Text>;

  partyStateToDisplay = party => (party?.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE ? t('RESIDENT') : getPartyStateToDisplay(party.state));

  getPartyTypeToDisplay = party => {
    const partyWorkflowMap = {
      [`${DALTypes.WorkflowName.NEW_LEASE}`]: `${t('LEASING_PARTY')}`,
      [`${DALTypes.WorkflowName.ACTIVE_LEASE}`]: `${t('RESIDENT_PARTY')}`,
      [`${DALTypes.WorkflowName.RENEWAL}`]: `${t('RENEWAL_PARTY')}`,
    };

    return partyWorkflowMap[party?.workflowName];
  };

  renderPartyInfo = party =>
    party && (
      <List>
        <div className={cf('party-type-bar', { isNewLease: party?.workflowName === DALTypes.WorkflowName.NEW_LEASE })}>
          <Text bold inline className={cf('party-type-text')}>
            {this.getPartyTypeToDisplay(party)}
          </Text>
        </div>
        {party.partyMembers.map(pm => (
          <ListItem rowStyle="mixed" key={pm.id}>
            <AvatarSection>
              <Avatar userName={pm.fullName} />
            </AvatarSection>
            <MainSection>
              <TextTitle> {getDisplayName(pm)} </TextTitle>
              <Text> {pm.preferredName} </Text>
            </MainSection>
          </ListItem>
        ))}
        <div>
          <Text inline bold>
            {this.partyStateToDisplay(party)}
          </Text>
          <Text inline>{` at ${party?.property?.displayName}`} </Text>
        </div>
        <Text inline> {t('LAST_CONTACTED_LABEL')}: </Text>
        <Text bold inline>
          {' '}
          {party.lastContactedDate ? formatDateAgo(party.lastContactedDate, this.props.timezone) : t('NO_COMMUNICATION_LABEL')}{' '}
        </Text>
        {party.partyOwner && (
          <div className={cf('party-owner')}>
            <Caption inline>{t('OWNER')} </Caption>
            <Caption secondary inline>
              {`${party.partyOwner}`}
            </Caption>
          </div>
        )}
        <div className={cf('merge-details')}>
          {party.appointments !== undefined && this.renderLabelWithValue('ONE_APPOINTMENT_LABEL', 'NUMBER_OF_APPOINTMENTS_LABEL', party.appointments)}
          {party.quotes !== undefined && this.renderLabelWithValue('ONE_QUOTE_LABEL', 'NUMBER_OF_QUOTES_LABEL', party.quotes)}
        </div>
      </List>
    );

  getLeasingAgent = agentId => {
    const { selectorData } = this.props;
    return (selectorData.allUsers && selectorData.allUsers.find(u => u.id === agentId)) || {};
  };

  handleCloseDialogAndClear = () => {
    this.props.closeMergePartyFlyout();
    this.props.clearSession();
    this.setState({ leasingAgent: null, selectedProperty: null, agentTeamId: null });
  };

  shouldShowPropertySelection = (firstParty, secondParty) => firstParty && secondParty && firstParty.assignedPropertyId !== secondParty.assignedPropertyId;

  getSelectedProperty = selectedPropertyName => {
    const { mergePartiesData } = this.props;
    const { firstParty, secondParty } = mergePartiesData;
    const properties = [firstParty.property, secondParty.property];

    const selectedProperty = properties.find(prop => prop.displayName === selectedPropertyName);

    return {
      id: selectedProperty.id,
      displayName: selectedProperty.displayName,
    };
  };

  handlePropertySelectionChange = (e, content) => {
    this.refs.propertySelectorFlyout.close();
    this.setState({
      selectedProperty: this.getSelectedProperty(content?.children),
    });
  };

  renderPropertyItem = property => (
    <ListItem key={property.id} onClick={this.handlePropertySelectionChange}>
      <MainSection>{property.displayName}</MainSection>
    </ListItem>
  );

  renderMergePartyOverlay = () => {
    const { leasingAgent, property, selectedProperty } = this.state;
    const { isLoading, selectorData, loggedInUser, mergePartiesData } = this.props;
    const { firstParty, secondParty, result } = mergePartiesData;

    const properties = [firstParty?.property, secondParty?.property];
    const showPropertySelection = this.shouldShowPropertySelection(firstParty, secondParty);

    return (
      <DialogOverlay id="mergePartiesDialog" title={t('MERGE_PARTIES_AT_PROPERTY_LABEL', { propertyName: property.displayName })} className={cf('mergeDialog')}>
        <div className={cf('panel')}>
          <div className={cf('form-container')}>
            <div className={cf('leftSection')}>
              <Divider label={t('MERGE_LABEL')} left />
              {this.renderPartyInfo(firstParty)}
              <Divider label={t('WITH_LABEL')} left />
              {this.renderPartyInfo(secondParty)}
            </div>
            <div className={cf('rightSection')}>
              <Divider label={t('PARTY_MERGE_RESULT_LABEL')} left />
              {this.renderPartyInfo(result)}
            </div>
          </div>
          <Text className={cf('selectorTitle')} inline>
            {t('SELECT_OWNER_TITLE')}
          </Text>
          <FlyOut ref="employeeSelectorFlyout" expandTo="bottom-right" overTrigger>
            <Button id="employeeSelectorBtn" type="wrapper" className={cf('dropdown')}>
              {leasingAgent ? (
                <EmployeeCard employeeName={leasingAgent.fullName} avatarUrl={leasingAgent.avatarUrl} title={leasingAgent.title} />
              ) : (
                <Text bold secondary inline>
                  {t('OWNER_REQUIRED')}
                </Text>
              )}
              <div className={cf('dd-icon')}>
                <Icon name="menu-down" />
              </div>
            </Button>
            <FlyOutOverlay data-id="employeeSelectorFlyoutOverlay" container={false} elevation={2}>
              <EmployeeSelector
                suggestedUsers={selectorData.users}
                users={selectorData.allUsers}
                currentUser={loggedInUser}
                onEmployeeSelected={this.handleLeasingAgentChange}
                placeholderText={t('FIND_MORE')}
              />
            </FlyOutOverlay>
          </FlyOut>
          {showPropertySelection && (
            <FlyOut ref="propertySelectorFlyout" expandTo="bottom-right" overTrigger>
              <Button id="propertySelectorBtn" type="wrapper" className={cf('dropdown')}>
                {selectedProperty ? (
                  <Text>{selectedProperty.displayName}</Text>
                ) : (
                  <Text bold secondary inline>
                    {t('SELECT_PROPERTY_PLACEHOLDER_REQUIRED')}
                  </Text>
                )}
                <div className={cf('dd-icon')}>
                  <Icon name="menu-down" />
                </div>
              </Button>
              <FlyOutOverlay data-id="propertySelectorFlyoutOverlay" container={false} elevation={2}>
                <List>{properties.map(this.renderPropertyItem)}</List>
              </FlyOutOverlay>
            </FlyOut>
          )}
        </div>
        <DialogActions>
          <Button
            id="doNotMergePartiesBtn"
            type="flat"
            btnRole="secondary"
            useWaves={true}
            label={t('DO_NOT_MERGE_LABEL')}
            onClick={this.handleDoNotMergeParty}
          />
          <Button
            id="mergePartiesBtn"
            type="flat"
            disabled={isLoading || !this.state.leasingAgent || (showPropertySelection && !this.state.selectedProperty)}
            useWaves={true}
            onClick={() => this.handleMergeParty(true)}
            label={t('MERGE_BUTTON_TEXT')}
          />
        </DialogActions>
        {isLoading && <PreloaderBlock modal />}
      </DialogOverlay>
    );
  };

  renderMergeConflictOverlay = () => {
    const { property } = this.state;
    const { fetchPartyMatch: getPartyMatch, sessionId, mergePartiesData } = this.props;
    const { firstParty, secondParty } = mergePartiesData;

    return (
      <DialogOverlay
        data-id="possibleDuplicatePartiesDialog"
        title={t('POSSIBLE_DUPLICATE_PARTIES_LABEL', { propertyName: property.displayName })}
        className={cf('mergeDialog')}>
        <Text data-id="mergePartyConflictTxt" className={cf('conflict-info')}>
          {t('MERGE_PARTY_CONFLICT_INFO')}
        </Text>
        <div className={cf('form-container')}>
          <div className={cf('leftSection')}>
            <Divider label={t('THIS_PARTY_LABEL')} left />
            {this.renderPartyInfo(firstParty)}
          </div>
          <div className={cf('rightSection')}>
            <Divider label={t('POSSIBLE_DUPLICATE_LABEL')} left dataId="possibleDuplicateTxt" />
            {this.renderPartyInfo(secondParty)}
          </div>
        </div>
        <DialogActions>
          <Button
            id="duplicatePartiesContinueBtn"
            type="flat"
            btnRole="secondary"
            useWaves={true}
            label={t('CONTINUE')}
            onClick={() => getPartyMatch(sessionId)}
          />
        </DialogActions>
      </DialogOverlay>
    );
  };

  renderNoDuplicateOverlay = () => {
    const mergeDialogTitle = getMergeDialogTitle(this.props.openedFrom);
    const mergeDialogBody = getMergeDialogBody(this.props.openedFrom);
    return (
      <DialogOverlay data-id="noDuplicateDialog" title={mergeDialogTitle} className={cf('noDuplicateDialog')}>
        <Text data-id="noDuplicatePartyFoundInfo1Txt" className={cf('no-duplicate-info')}>
          {mergeDialogBody}
        </Text>
        <DialogActions>
          <Button data-id="noDuplicateDialogOkBtn" type="flat" useWaves={true} onClick={this.handleCloseDialogAndClear} label={t('OK, GOT IT')} />
        </DialogActions>
      </DialogOverlay>
    );
  };

  handleAddTransferPartyReason = async ({ reassignReason }) => {
    await this.props.addTransferReasonActivityLogAndComm(this.state.transerPartyInfo, reassignReason);
    this.setState({ showTranferPartyDialog: false, transferPartyDialogContent: '', transerPartyInfo: {} });
  };

  cancelTransferPartyDialog = () => this.setState({ showTranferPartyDialog: false, transferPartyDialogContent: '', transerPartyInfo: {} });

  render = () => {
    const { isOpen, mergePartiesData, sessionId, isLoading, error, appointmentsConflictData, timezone } = this.props;
    const { isMergeConflict, result } = mergePartiesData;
    const { showTranferPartyDialog, transferPartyDialogContent } = this.state;
    const shouldDisplayMergeOverlay = (isLoading && isOpen) || (result && !isMergeConflict);
    const shouldDisplayMergeConflict = isMergeConflict && result;
    const shouldDisplayNoDuplicates = !result && !isLoading && sessionId;
    const shouldDisplayError = error && isOpen;
    const shouldDisplayApptsConflict = appointmentsConflictData && isOpen;
    const mergePartyDialogHasContent = shouldDisplayMergeOverlay || shouldDisplayMergeConflict || shouldDisplayNoDuplicates;

    return (
      (shouldDisplayError && (
        <MsgBox open={shouldDisplayError} lblOK={t('OK')} lblCancel="" onCloseRequest={this.handleCloseDialogAndClear}>
          <Text>{t('ERROR_GENERATING_TOKEN')}</Text>
        </MsgBox>
      )) ||
      (shouldDisplayApptsConflict && (
        <AssignPartyAppointmentConflictDialog
          open={shouldDisplayApptsConflict}
          onClose={() => this.props.clearAppointmentsError()}
          onOverbookRequest={() => this.handleMergeParty(false)}
          selectedPartyAssignee={this.state.leasingAgent}
          conflictingAppointmentIds={appointmentsConflictData.appointments.map(a => a.id)}
          appointments={appointmentsConflictData.appointments}
          timezone={timezone}
        />
      )) ||
      (isOpen && mergePartyDialogHasContent && (
        <Dialog open={isOpen} appendToBody baseZIndex={200} closeOnTapAway={false} closeOnEscape={false}>
          {shouldDisplayMergeConflict && this.renderMergeConflictOverlay()}
          {shouldDisplayMergeOverlay && this.renderMergePartyOverlay()}
          {shouldDisplayNoDuplicates && this.renderNoDuplicateOverlay()}
        </Dialog>
      )) ||
      (showTranferPartyDialog && !isOpen && (
        <TransferPartyDialog
          open={showTranferPartyDialog}
          transferPartyDialogContent={transferPartyDialogContent}
          handleOnSubmit={this.handleAddTransferPartyReason}
          cancelTransferPartyDialog={this.cancelTransferPartyDialog}
        />
      ))
    );
  };
}
