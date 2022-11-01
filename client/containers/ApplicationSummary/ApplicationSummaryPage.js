/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { FullScreenDialog, DialogTitle, DialogHeaderActions, TwoPanelPage, LeftPanel, RightPanel, PreloaderBlock, Button, Iframe } from 'components';
import { t } from 'i18next';
import { startAddingRequireWorkTask } from 'redux/modules/tasks';
import { updateQuotePromotion } from 'redux/modules/quotes';
import { loadInventoryDetails } from 'redux/modules/inventoryStore';
import { getInventoryShorthand, termText, getUnitDepositAmount } from 'helpers/quotes';
import { windowOpen } from 'helpers/win-open';
import { createSelector } from 'reselect';
import { getLeases } from 'redux/selectors/partySelectors';
import { ApprovalDialog } from './Dialog/ApprovalDialog';
import { DeclineDialog } from './Dialog/DeclineDialog';
import NoScreeningDialog from './Dialog/NoScreeningDialog';
import { convertTenantToRentappUrl } from '../../helpers/resolve-url';
import { QuoteSummarySection } from './QuoteSummarySection';
import { cf } from './ApplicationSummaryPage.scss';
import { DALTypes } from '../../../common/enums/DALTypes';

import DemoteDialog from '../ProspectDetailPage/Applications/DemoteDialog';
import LeasedUnitDialog from '../ProspectDetailPage/LeasedUnitDialog';
import { isInventoryLeasedOnPartyType } from '../../../common/helpers/inventory';
import { ApprovalSummaryTypes } from '../../../common/enums/messageTypes';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import { isUserAuthorizedToExportCreditReport } from '../../../common/helpers/utils';
import { areAllApplicationsCompleted } from '../../redux/selectors/applicationSelectors';
import { LeaseStartWarning } from '../../custom-components/SummaryWarnings/LeaseStartWarning';
import { getInventoryAvailabilityForReviewScreening } from '../../redux/selectors/inventorySelectors';
import { getParty, getAssociatedPropertySettingsForParty } from '../../redux/selectors/partySelectors';

const dialogs = {
  APPROVE: 'approve',
  DECLINE: 'decline',
  REVOKE: 'revoke',
  CREATE_LEASE: 'create_lease',
  NO_SCREENING: 'no_screening',
};

const getExecutedLease = createSelector(getLeases, leases => leases.find(l => l.status === DALTypes.LeaseStatus.EXECUTED));

@connect(
  (state, props) => ({
    userToken: state.auth.token,
    inventory: state.inventoryStore.inventory,
    quoteFetchFailed: state.quotes.quoteFetchFailed,
    isRequireWorkTask: state.tasks.isRequireWorkTask,
    areAllPartyApplicationsCompleted: areAllApplicationsCompleted(state, props),
    inventoryAvailability: getInventoryAvailabilityForReviewScreening(state, props),
    party: getParty(state, props),
    propertySettings: getAssociatedPropertySettingsForParty(state, props),
    loadingInventoryDetails: state.inventoryStore.loadingInventoryDetails,
    lease: getExecutedLease(state, props),
    currentUser: state.auth.user,
  }),
  dispatch =>
    bindActionCreators(
      {
        startAddingRequireWorkTask,
        updateQuotePromotion,
        loadInventoryDetails,
      },
      dispatch,
    ),
)
export default class ApplicationSummaryPage extends Component {
  static propTypes = {
    open: PropTypes.bool,
    onCloseRequest: PropTypes.func,
    partyId: PropTypes.string.isRequired,
    startAddingRequireWorkTask: PropTypes.func,
    members: PropTypes.object,
    onApprove: PropTypes.func,
    quote: PropTypes.object,
    screeningSummary: PropTypes.object,
    applicantsWithDisclosures: PropTypes.array,
    onDecline: PropTypes.func,
    quotePromotion: PropTypes.object,
    hasALease: PropTypes.bool,
    selectedLeaseTermId: PropTypes.string,
    canReviewApplication: PropTypes.bool,
    onCreateLease: PropTypes.func,
    screeningApplicationDecision: PropTypes.string,
    onRequestApproval: PropTypes.func,
    onRevokeApplication: PropTypes.func,
    loadInventoryDetails: PropTypes.func,
    screeningDelayedDecision: PropTypes.string,
  };

  handleViewFullQuote = () => {
    const { quote } = this.props;
    const urlPublishedQuote = `${window.location.protocol}//${window.location.host}/quote/${quote.id}`;
    windowOpen(urlPublishedQuote);
  };

  constructor(props) {
    super(props);

    this.state = {
      isApproveDialogOpen: false,
      isDeclineDialogOpen: false,
      isLoadingIframe: true,
      isDemoteApplicationDialogOpen: false,
      isLeasedUnitDialogOpen: false,
      isUnitLeased: isInventoryLeasedOnPartyType(props.quote.inventory.state, props.party),
      isNoScreeningDialogOpen: false,
      confirmationLoading: false,
      isIFrameHidden: true,
    };
  }

  componentDidUpdate = async prevProps => {
    const savedRequiredWorkTask = prevProps.isRequireWorkTask && !this.props.isRequireWorkTask;
    const { quotePromotion, partyId } = this.props;
    if (!savedRequiredWorkTask) return;
    quotePromotion?.id && (await this.props.updateQuotePromotion(partyId, quotePromotion.id, DALTypes.PromotionStatus.CANCELED, { skipEmail: true }));
    await this.props.onCloseRequest();
  };

  handleOnCreateLease = () => {
    const { quote = {}, onCreateLease } = this.props;
    const createLeaseModel = { quoteId: quote.id };
    onCreateLease && onCreateLease(createLeaseModel);
  };

  handleDialogs = (dialogName, showDialog) => {
    const { isUnitLeased } = this.state;
    let stateInfo = { isLeasedUnitDialogOpen: showDialog };

    switch (dialogName) {
      case dialogs.APPROVE:
        if (!isUnitLeased) stateInfo = { isApproveDialogOpen: showDialog };
        break;
      case dialogs.DECLINE:
        if (!isUnitLeased) stateInfo = { isDeclineDialogOpen: showDialog };
        break;
      case dialogs.REVOKE:
        stateInfo = { isDemoteApplicationDialogOpen: showDialog };
        break;
      case dialogs.CREATE_LEASE:
        if (!isUnitLeased) {
          stateInfo = { ...stateInfo, confirmationLoading: true };
          this.handleOnCreateLease();
        }
        break;
      case dialogs.NO_SCREENING:
        stateInfo = { isNoScreeningDialogOpen: showDialog };
        break;
      default:
    }

    stateInfo = { confirmationLoading: showDialog, ...stateInfo };
    this.setState(stateInfo);
  };

  handleConfirmationDialog = (dialogName, isScreeningIncomplete, shouldOpenDialog = false) => {
    if (isScreeningIncomplete) {
      this.setState({ isNoScreeningDialogOpen: true, dialogName });
    } else {
      this.handleDialogs(dialogName, shouldOpenDialog);
    }
  };

  handleOnConfirmation = () => {
    const dialogName = this.state.dialogName;
    this.setState({ isNoScreeningDialogOpen: false });
    this.handleDialogs(dialogName, true);
  };

  handleOnApprove = approvalModel => {
    const { onApprove } = this.props;
    this.handleDialogs(dialogs.APPROVE, false);
    // Keep overlay on the application review dialog until the lease dialog shows
    this.setState({ confirmationLoading: true });
    onApprove && onApprove(approvalModel);
  };

  handleOnDecline = declineModel => {
    const { onDecline } = this.props;
    this.handleDialogs(dialogs.DECLINE, false);
    onDecline && onDecline(declineModel);
  };

  handleRequireWorkClick = () => {
    const { isUnitLeased } = this.state;
    if (isUnitLeased) {
      this.setState({
        isLeasedUnitDialogOpen: true,
      });
    } else {
      this.props.startAddingRequireWorkTask();
    }
  };

  handleRequestApproval = () => {
    const { isUnitLeased } = this.state;
    if (isUnitLeased) {
      this.setState({
        isLeasedUnitDialogOpen: true,
      });
    } else {
      const { onRequestApproval } = this.props;
      onRequestApproval && onRequestApproval();
    }
  };

  handleOpenDemoteApplicationDialog = () => {
    this.setState({
      isDemoteApplicationDialogOpen: true,
    });
  };

  handleCloseDemoteApplicationDialogWrapper = () => {
    this.handleDialogs(dialogs.REVOKE, false);
  };

  areAllPartyApplicationsComplete = (partyResidents, screenedResidents, partyGuarantors, screenedGuarantors) => {
    partyResidents = partyResidents || [];
    screenedResidents = screenedResidents || [];
    partyGuarantors = partyGuarantors || [];
    screenedGuarantors = screenedGuarantors || [];

    const someResidentsHavePendingScreening = partyResidents.length > screenedResidents.length;
    const someGuarantorsHavePendingScreening = partyGuarantors.length > screenedGuarantors.length;

    return someResidentsHavePendingScreening || someGuarantorsHavePendingScreening;
  };

  handleConfirmationDialogWrapper = (dialogType, isScreeningIncomplete) => () => this.handleConfirmationDialog(dialogType, isScreeningIncomplete, true);

  renderLAADialogActions = (hasALease, isScreeningIncomplete, disableActions) => (
    <DialogHeaderActions className={cf('application-actions')}>
      <Button
        id="applicationSummaryDeclineBtn"
        btnRole="secondary"
        label={t('APPROVAL_SUMMARY_DECLINE')}
        onClick={this.handleConfirmationDialogWrapper(dialogs.DECLINE, isScreeningIncomplete)}
        disabled={disableActions}
      />
      <Button
        id="applicationSummaryRequireWorkBtn"
        btnRole="secondary"
        label={t('APPROVAL_SUMMARY_REQUIRE_WORK')}
        onClick={this.handleRequireWorkClick}
        disabled={disableActions}
      />
      <Button
        btnRole="secondary"
        label={t('APPROVAL_SUMMARY_APPROVE')}
        onClick={this.handleConfirmationDialogWrapper(dialogs.APPROVE, isScreeningIncomplete)}
        data-id="btnApproveApplication"
        primaryBg={true}
        disabled={disableActions}
      />
    </DialogHeaderActions>
  );

  renderNonLAADialogActions = (hasALease, isScreeningIncomplete, disableActions) => {
    const { quotePromotion } = this.props;

    if (quotePromotion) {
      return (
        <DialogHeaderActions className={cf('application-actions')}>
          <Button
            btnRole="secondary"
            label={t('CANCEL_APPROVAL_REQUEST')}
            onClick={() => this.handleDialogs(dialogs.REVOKE, true)}
            id="btnCancelApproval"
            disabled={disableActions}
          />
        </DialogHeaderActions>
      );
    }

    return (
      <DialogHeaderActions className={cf('application-actions')}>
        <Button
          btnRole="secondary"
          label={t('REQUEST_APPROVAL')}
          onClick={() => this.handleRequestApproval()}
          id="btnRequestApproval"
          disabled={disableActions}
        />
      </DialogHeaderActions>
    );
  };

  renderAgentsCommonActions = (hasALease, isScreeningIncomplete, isDecisionApproved, isLeaseExecuted, disableActions) => {
    const { confirmationLoading } = this.state;

    if (hasALease) {
      return (
        <DialogHeaderActions className={cf('application-actions')}>
          <Button
            btnRole="secondary"
            label={t('REVOKE_APPROVED_APPLICATION')}
            onClick={() => this.handleDialogs(dialogs.REVOKE, true)}
            disabled={isLeaseExecuted}
            id="btnRevoke"
          />
        </DialogHeaderActions>
      );
    }

    if (isDecisionApproved) {
      return (
        <DialogHeaderActions className={cf('application-actions')}>
          <Button
            btnRole="secondary"
            id="btnCreateLease"
            primaryBg={true}
            loading={confirmationLoading}
            disabled={disableActions}
            label={t('CREATE_LEASE')}
            onClick={() => this.handleConfirmationDialog(dialogs.CREATE_LEASE, isScreeningIncomplete)}
          />
        </DialogHeaderActions>
      );
    }

    return <div />;
  };

  renderDialogActions = () => {
    const { hasALease, lease, canReviewApplication, areAllPartyApplicationsCompleted, screeningApplicationDecision } = this.props;
    const isDecisionApproved = screeningApplicationDecision === ScreeningDecision.APPROVED;
    const isScreeningIncomplete = !areAllPartyApplicationsCompleted;
    const isLeaseExecuted = !!lease;
    const { isIFrameHidden, confirmationLoading } = this.state;
    const disableActions = isIFrameHidden || confirmationLoading;

    const actions = this.renderAgentsCommonActions(hasALease, isScreeningIncomplete, isDecisionApproved, isLeaseExecuted, disableActions);
    const isPromotedToLeaseOrApproved = hasALease || isDecisionApproved;

    if (isPromotedToLeaseOrApproved) return actions;

    return canReviewApplication
      ? this.renderLAADialogActions(hasALease, isScreeningIncomplete, disableActions)
      : this.renderNonLAADialogActions(hasALease, isScreeningIncomplete, disableActions);
  };

  componentWillMount = async () => {
    const { quote, inventory } = this.props;
    if (inventory?.id === quote.inventory.id) return;

    this.props.loadInventoryDetails({ id: quote.inventory.id });
  };

  renderQuoteSummary = () => {
    const { quote, quoteFetchFailed, inventory, loadingInventoryDetails } = this.props;

    if (quoteFetchFailed) {
      return <div />;
    }

    if (!quote || loadingInventoryDetails) {
      return <PreloaderBlock />;
    }

    return <QuoteSummarySection quote={quote} inventory={inventory} onViewFullQuote={this.handleViewFullQuote} />;
  };

  handleCompletedLoad = () => {
    this.setState({ isLoadingIframe: false });
    setTimeout(() => this.setState({ isIFrameHidden: false }), 200);
  };

  iframeMsgsActionsMap = {
    [ApprovalSummaryTypes.GO_TO_PARTY]: leasingNavigator.navigateToParty,
  };

  onIframeMessageReceived = msg => this.iframeMsgsActionsMap[msg.type](msg.data.partyId);

  onLeasedUnitDialogClosed = () => this.setState({ isLeasedUnitDialogOpen: false });

  handleDialogsCloseWrapper = dialogType => () => this.handleDialogs(dialogType, false);

  render = () => {
    const {
      open,
      onCloseRequest,
      partyId,
      quote,
      applicantsWithDisclosures,
      quotePromotion,
      hasALease,
      selectedLeaseTermId,
      canReviewApplication,
      currentUser,
      screeningDelayedDecision,
      screeningApplicationDecision,
      party,
      propertySettings,
    } = this.props;

    const canSeeCreditReport = isUserAuthorizedToExportCreditReport(screeningApplicationDecision, currentUser, party.ownerTeam);
    const { isApproveDialogOpen, isDeclineDialogOpen, isDemoteApplicationDialogOpen, isNoScreeningDialogOpen } = this.state;
    const buildingName = quote.inventory.building && quote.inventory.building.name;
    const inventoryName = getInventoryShorthand({
      buildingName,
      inventoryName: quote.inventory.name,
    });
    const unitDepositAmount = getUnitDepositAmount(quote);
    const activeLeaseTerm = quote.leaseTerms.find(term => term.id === selectedLeaseTermId);
    const formattedLeaseTermsLength = activeLeaseTerm && termText(activeLeaseTerm);
    const { isLoadingIframe, isIFrameHidden, isLeasedUnitDialogOpen, confirmationLoading } = this.state;
    const disableActions = confirmationLoading || isIFrameHidden;
    const {
      inventoryAvailability: { isInventoryUnavailable, inventoryAvailableDate, inventory },
    } = this.props;
    const params = !quotePromotion
      ? { partyId, canReviewApplication, canSeeCreditReport, quoteId: quote.id, leaseTermId: selectedLeaseTermId, screeningDelayedDecision }
      : { partyId, canReviewApplication, canSeeCreditReport };

    return (
      <FullScreenDialog
        id="approvalSummary"
        open={open}
        onCloseRequest={onCloseRequest}
        disabledCloseButton={disableActions}
        title={
          <DialogTitle lighter key="title">
            {t('APPROVAL_SUMMARY_TITLE', { inventoryName })}
          </DialogTitle>
        }
        actions={this.renderDialogActions()}>
        <TwoPanelPage className={cf('overlay', { activeOverlay: confirmationLoading })}>
          <LeftPanel noOverflow>
            {isInventoryUnavailable && (
              <LeaseStartWarning content={t('UNIT_NOT_AVAILABLE_TO_LEASE_WARNING', { name: inventory.name, date: inventoryAvailableDate })} />
            )}
            {isLoadingIframe && <PreloaderBlock />}
            <Iframe
              data-id="applicationSummaryFrame"
              src={convertTenantToRentappUrl({ ...params }, this.props.userToken)}
              onLoad={this.handleCompletedLoad}
              onMessage={this.onIframeMessageReceived}
              className={cf('iframe', { hide: isLoadingIframe })}
            />
          </LeftPanel>
          <RightPanel>
            <div className={cf('panel-wrapper')}>{this.renderQuoteSummary()}</div>
          </RightPanel>
        </TwoPanelPage>
        <NoScreeningDialog
          open={isNoScreeningDialogOpen}
          onConfirm={this.handleOnConfirmation}
          onCloseRequest={this.handleDialogsCloseWrapper(dialogs.NO_SCREENING)}
        />
        <ApprovalDialog
          dialogOpen={isApproveDialogOpen}
          onCloseRequest={this.handleDialogsCloseWrapper(dialogs.APPROVE)}
          partyId={partyId}
          unitDepositAmount={unitDepositAmount}
          inventoryName={inventoryName}
          onApprove={this.handleOnApprove}
          applicantsWithDisclosures={applicantsWithDisclosures}
        />
        <DeclineDialog
          dialogOpen={isDeclineDialogOpen}
          onCloseRequest={this.handleDialogsCloseWrapper(dialogs.DECLINE)}
          inventoryName={quote.inventory.fullQualifiedName}
          formattedLeaseTermsLength={formattedLeaseTermsLength}
          partyId={partyId}
          onDecline={this.handleOnDecline}
          propertySettings={propertySettings}
        />
        <DemoteDialog
          quotePromotion={quotePromotion}
          isDemoteApplicationDialogOpen={isDemoteApplicationDialogOpen}
          onDialogClosed={this.handleCloseDemoteApplicationDialogWrapper}
          hasALease={hasALease}
          dialogTitle={t('REVOKE_APPROVED_APPLICATION')}
        />
        {isLeasedUnitDialogOpen && (
          <LeasedUnitDialog
            isLeasedUnitDialogOpen={isLeasedUnitDialogOpen}
            partyMembers={quote.inventory.leasePartyMembers}
            onDialogClosed={this.onLeasedUnitDialogClosed}
            approvalText={t('LEASED_UNIT_DIALOG_APPROVER')}
          />
        )}
      </FullScreenDialog>
    );
  };
}
