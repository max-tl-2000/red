/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { FullScreenDialog, DialogTitle, DialogHeaderActions, PreloaderBlock, MsgBox, Typography as T } from 'components';
import { connect } from 'react-redux';
import { observer, inject } from 'mobx-react';
import { isDirty } from 'redux-form';
import { action, observable } from 'mobx';
import { InventoryHoldingWarningDialog } from 'containers/Quotes/InventoryHoldingWarningDialog';
import { bindActionCreators } from 'redux';
import { publishLease, fetchLeaseAdditionalData, clearLeaseAdditionalData, downloadLeaseDocument } from 'redux/modules/leaseStore';
import DownloadLeaseButton from '../LeaseForm/DownloadLeaseButton';
import DiscardEditsDialog from '../LeaseForm/DiscardEditsDialog';
import LeaseFormSubmitButton from '../LeaseForm/LeaseFormSubmitButton';
import LeaseForm from '../LeaseForm/LeaseForm';
import PublishLeaseDialog from '../LeaseForm/PublishLeaseDialog';
import {
  getUnitNameForSelectedLease,
  isReadOnlyLease,
  getLeaseFormData,
  isDraftLease,
  doesLeaseHaveDigitallySignedDocument,
  doesLeaseHaveWetSignedEnvelope,
} from '../../redux/selectors/leaseSelectors';
import DialogModel from './DialogModel';
import { createInventoryUnavailableDialogModel, isInventoryLeasedOnPartyType } from '../../../common/helpers/inventory';
import { getPromotedQuotes, getActiveQuotePromotion, getActiveLeases } from '../../redux/selectors/partySelectors';
import { getAllowRentableItemSelection } from '../../redux/selectors/inventorySelectors';
import { getInventoryHoldStatus } from '../../helpers/quotes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { InvalidEmailWarningDialog } from '../LeaseForm/InvalidEmailWarningDialog';
import { getMembersWithInvalidEmail } from '../../helpers/party';
import { isBlueMoonLeasingProviderMode } from '../../../common/helpers/utils';

const getQuoteByQuoteId = (quotes, quoteId) => quotes.find(quote => quote.id === quoteId);

export class LeaseFormDialogWrapper extends Component {
  @observable
  inventoryHoldingWarningDialogModel;

  @observable
  unavailableRentableItemsSelectedMap = {};

  @observable
  noRentableItemsSelectedMap = {};

  constructor(props) {
    super(props);

    const dlgDiscardEdits = new DialogModel();
    const dlgInventoryHoldingWarning = new DialogModel();
    const dlgInvalidEmailWarning = new DialogModel();
    const dlgReviewChargesDialog = new DialogModel();
    const dlgUnavailableRentableItemsSelected = new DialogModel();
    const dlgNoPartyRepresentativeSelected = new DialogModel();
    const dlgWetSignedNotAvailableForDownload = new DialogModel();

    // storing this in the state to play nice with HMR
    this.state = {
      dlgDiscardEdits,
      dlgInventoryHoldingWarning,
      dlgReviewChargesDialog,
      dlgUnavailableRentableItemsSelected,
      dlgNoPartyRepresentativeSelected,
      dlgWetSignedNotAvailableForDownload,
      dlgInvalidEmailWarning,
      unavailableToLease: false,
      partyRepresentative: '',
      showPartyRepresentativeErrorMessage: false,
      leaseId: props.selectedLeaseId,
      termLengthOverride: null,
      areAdditionalChargesUnchecked: false,
      areConcessionsUnchecked: false,
      areOneTimeChargesUnchecked: false,
      shouldDisplayUnselectedRentableItemsBanner: false,
    };
  }

  componentWillReceiveProps = nextProps => {
    const { partyId, selectedLeaseId: leaseId, leaseFormData } = nextProps;

    if (this.state.leaseId !== leaseId && leaseId) {
      this.props.clearLeaseAdditionalData();
      this.props.fetchLeaseAdditionalData(partyId, leaseId);
      const nextState = { ...this.state, termLengthOverride: null, leaseId };
      this.setState(nextState);
    }
    if (leaseId) {
      this.props.dlgApplicationSummary && this.props.dlgApplicationSummary.close();
    }

    if (!this.state.partyRepresentative && leaseFormData?.baselineData?.partyRepresentative) {
      const partyRepresentative = leaseFormData?.baselineData?.partyRepresentative.map(pr => pr.id);
      this.updatePartyRepresentative(partyRepresentative[0]);
    }
  };

  componentWillUnmount = () => {
    // clear the leaseStore.additionalData is needed because otherwise the form will shown the wrong information
    // specially the wrong info for BASE_RENT and inventory details
    // The clear action is needed in the unmount to load the right data since the beginning
    this.props.clearLeaseAdditionalData && this.props.clearLeaseAdditionalData();
  };

  setLeaseAvailability = availavility => {
    this.setState({ unavailableToLease: availavility });
  };

  updatePartyRepresentative = partyRerpresentativeId => {
    this.setState({ partyRepresentative: partyRerpresentativeId });
  };

  getApplicationSettingsForProperty = propertyId => {
    const { properties } = this.props;
    const property = properties.find(p => p.id === propertyId);

    if (!property) {
      return {};
    }
    return (property.settings || {}).applicationSettings;
  };

  isExportEnabledForProperty = propertyId => {
    const { properties, isRenewal } = this.props;
    const property = properties.find(p => p.id === propertyId);

    if (!property) {
      return {};
    }
    return isRenewal ? property.settings?.integration?.export?.renewalLease : property.settings?.integration?.export?.newLease;
  };

  doesLeaseProviderHandleEDocuments = propertyId => {
    let doesLeaseProviderHandleEDocuments = false;
    const { properties, leasingProviderMode } = this.props;
    const property = (properties || []).find(p => p.id === propertyId);
    const bmAutoESignatureRequest = property?.settings?.integration?.lease?.bmAutoESignatureRequest;
    if (!property || (isBlueMoonLeasingProviderMode(leasingProviderMode) && !bmAutoESignatureRequest)) {
      doesLeaseProviderHandleEDocuments = true;
    }
    return { doesLeaseProviderHandleEDocuments, leaseProviderLoginUrl: property?.settings?.lease?.leaseProviderLoginUrl };
  };

  shouldDisplayPartyRepresentativeSelection = propertyId => {
    const { properties, isCorporateParty } = this.props;
    const property = properties?.find(p => p.id === propertyId);

    if (!property) {
      return false;
    }

    return property.settings?.lease?.allowPartyRepresentativeSelection && !isCorporateParty;
  };

  overrideLeaseTerm = () => {
    const { additionalLeaseData } = this.props;
    const { termLengthOverride } = this.state;
    if (termLengthOverride) {
      const publishedTerm = additionalLeaseData.publishedTerm;
      const originalTermLength = publishedTerm.originalTermLength || publishedTerm.termLength;
      additionalLeaseData.publishedTerm = {
        ...publishedTerm,
        termLength: originalTermLength,
      };
    }
  };

  get dlgDiscardEdits() {
    return this.state.dlgDiscardEdits;
  }

  get dlgInventoryHoldingWarning() {
    return this.state.dlgInventoryHoldingWarning;
  }

  get dlgReviewChargesDialog() {
    return this.state.dlgReviewChargesDialog;
  }

  get dlgUnavailableRentableItemsSelected() {
    return this.state.dlgUnavailableRentableItemsSelected;
  }

  get dlgNoPartyRepresentativeSelected() {
    return this.state.dlgNoPartyRepresentativeSelected;
  }

  get dlgInvalidEmailWarning() {
    return this.state.dlgInvalidEmailWarning;
  }

  get dlgWetSignedNotAvailableForDownload() {
    return this.state.dlgWetSignedNotAvailableForDownload;
  }

  get membersWithInvalidEmail() {
    const { partyMembers, isCorporateParty } = this.props;
    return getMembersWithInvalidEmail(partyMembers?.toArray() || [], isCorporateParty);
  }

  @action
  onInventoryHoldingWarningDialogClosed = () => {
    this.dlgInventoryHoldingWarning.close();
  };

  @action
  onReviewChargesDialogClosed = () => {
    this.dlgReviewChargesDialog.close();
  };

  @action
  onUnavailableRentableItemsSelectedDialogClosed = () => {
    this.dlgUnavailableRentableItemsSelected.close();
  };

  @action
  onNoPartyRepresentativeSelectedDialogClosed = () => {
    this.dlgNoPartyRepresentativeSelected.close();
  };

  @action
  onInvalidEmailWarningDialogClosed = () => {
    this.dlgInvalidEmailWarning.close();
  };

  @action
  onViewParty = partyId => {
    const {
      props,
      dlgInventoryHoldingWarning,
      dlgInvalidEmailWarning,
      dlgReviewChargesDialog,
      dlgUnavailableRentableItemsSelected,
      dlgNoPartyRepresentativeSelected,
      dlgWetSignedNotAvailableForDownload,
    } = this;
    const { dlgLeaseForm } = props;

    dlgInventoryHoldingWarning.close();
    dlgInvalidEmailWarning.close();
    dlgLeaseForm.close();
    dlgReviewChargesDialog.close();
    dlgUnavailableRentableItemsSelected.close();
    dlgNoPartyRepresentativeSelected.close();
    dlgWetSignedNotAvailableForDownload.close();
    props.leasingNavigator.navigateToParty(partyId);
  };

  @action
  handleLeaseTermLengthChanged = newLeaseTermLength => {
    this.setState({ termLengthOverride: newLeaseTermLength });
  };

  areInvalidRentableItemsSelected = rentableItems => !!Object.values(rentableItems).filter(x => !!x).length;

  shouldOpenUnavailableRentableItemsDialog = () => {
    const isAnyRentableItemUnselected = this.areInvalidRentableItemsSelected(this.noRentableItemsSelectedMap);

    return isAnyRentableItemUnselected;
  };

  shouldOpenNoPartyRepresentativeDialog = () => {
    const { promotedQuote } = this.props;
    const { partyRepresentative } = this.state;

    const isPartyRepresentativeSelectionEnabled = this.shouldDisplayPartyRepresentativeSelection(promotedQuote?.inventory?.property?.id);
    return isPartyRepresentativeSelectionEnabled && !partyRepresentative;
  };

  @action
  handlePublishLease = (partyId, leaseId, lease, quoteId) => {
    const { props, membersWithInvalidEmail } = this;

    const { areConcessionsUnchecked, areAdditionalChargesUnchecked, areOneTimeChargesUnchecked } = this.state;

    if (this.shouldOpenNoPartyRepresentativeDialog()) {
      this.setState({ showPartyRepresentativeErrorMessage: true });
      this.dlgNoPartyRepresentativeSelected.open();
      return;
    }

    if (this.shouldOpenUnavailableRentableItemsDialog()) {
      this.dlgUnavailableRentableItemsSelected.open();
      return;
    }

    if (areConcessionsUnchecked || areAdditionalChargesUnchecked || areOneTimeChargesUnchecked) {
      this.dlgReviewChargesDialog.open();
      return;
    }

    if (membersWithInvalidEmail.length) {
      this.dlgInvalidEmailWarning.open();
      return;
    }

    const { quotes, party } = props;
    const quote = getQuoteByQuoteId(quotes, quoteId);

    const { inventoryHeldModel, isHeldByOtherParty } = getInventoryHoldStatus(quote, party?.workflowName);

    let inventoryLeased;
    let warningMessage = (inventoryHeldModel || {}).msg;
    let heldByPartyId = (inventoryHeldModel || {}).partyId;

    if (!isHeldByOtherParty) {
      inventoryLeased = isInventoryLeasedOnPartyType(quote.inventory.state, party);
      if (inventoryLeased) {
        warningMessage = t('LEASED_UNIT_WARNING', { unitName: quote.inventory.name });
        heldByPartyId = quote.inventory.leasePartyMembers[0] && quote.inventory.leasePartyMembers[0].partyId;
      }
    }

    if (!isHeldByOtherParty && !inventoryLeased) {
      props.publishLease(partyId, leaseId, lease);
      return;
    }

    this.inventoryHoldingWarningDialogModel = createInventoryUnavailableDialogModel({
      partyId: heldByPartyId,
      onInventoryHoldingWarningDialogClosed: this.onInventoryHoldingWarningDialogClosed,
      onViewParty: this.onViewParty,
      title: t('LEASE_CANT_BE_PUBLISHED_TITLE'),
      text: warningMessage,
    });

    this.dlgInventoryHoldingWarning.open();
    return;
  };

  @action
  handleCloseLeaseFormDialog = readOnlyLease => {
    const {
      props: { leaseFormDirty, dlgLeaseForm },
      dlgDiscardEdits,
    } = this;

    if (leaseFormDirty && !readOnlyLease) {
      dlgDiscardEdits.open();
      // Force rerender as the modal won't show up
      const newState = {
        ...this.state,
        shouldDisplayUnselectedRentableItemsBanner: false,
        showPartyRepresentativeErrorMessage: false,
        partyRepresentative: '',
      };
      this.setState(newState);
    } else {
      dlgLeaseForm.clearSelectedLeaseAndClose();
      const nextState = { ...this.state, showPartyRepresentativeErrorMessage: false, partyRepresentative: '', termLengthOverride: null };
      this.setState(nextState);
    }
  };

  @action
  handleCloseDiscardEditsDialog = performDiscard => {
    const {
      props: { dlgLeaseForm },
      dlgDiscardEdits,
    } = this;
    if (performDiscard) {
      dlgDiscardEdits.close();
      dlgLeaseForm.clearSelectedLeaseAndClose();
      const nextState = { ...this.state, termLengthOverride: null, showPartyRepresentativeErrorMessage: false, partyRepresentative: '' };
      this.unavailableRentableItemsSelectedMap = {};
      this.noRentableItemsSelectedMap = {};
      this.overrideLeaseTerm();
      this.setState(nextState);
    } else {
      dlgDiscardEdits.close();
    }
  };

  @action
  handleAddEmailAddress = memberIds => {
    const { partyId, onAddEmailAddress } = this.props;
    this.onViewParty(partyId);
    onAddEmailAddress && onAddEmailAddress(memberIds[0]);
  };

  renderWetSignedNotAvailableForDownloadDialog = () => (
    <MsgBox
      id="dlgWetSignedNotAvailableForDownloadMsgBox"
      open={this.dlgWetSignedNotAvailableForDownload.isOpen}
      closeOnTapAway={false}
      lblOK={t('OK')}
      lblCancel=""
      onCloseRequest={() => this.dlgWetSignedNotAvailableForDownload.close()}
      title={t('LEASE_NOT_AVAILABLE_FOR_DOWNLOAD_TITLE')}>
      <T.Text>{t('WETSIGNED_NOT_AVAILABLE_FOR_DOWNLOAD_MSG')}</T.Text>
    </MsgBox>
  );

  handleDownloadLease = leaseId => {
    const { leaseHasDigitallySignedDocument, leaseHasWetSignedEnvelope } = this.props;
    if (!leaseHasDigitallySignedDocument) {
      if (leaseHasWetSignedEnvelope) {
        this.dlgWetSignedNotAvailableForDownload.open();
        return;
      }
      // TODO this is unexpected -- what to do?
    }
    this.props.downloadLeaseDocument(leaseId);
  };

  handleCheckAdditionalCharges = value => this.setState({ areAdditionalChargesUnchecked: value });

  handleCheckConcessions = value => this.setState({ areConcessionsUnchecked: value });

  handleCheckOneTimeCharges = value => this.setState({ areOneTimeChargesUnchecked: value });

  @action
  handleUnavailableRentableItemsSelected = (value, feeId) => {
    this.unavailableRentableItemsSelectedMap[feeId] = value;
    const shouldDisplayUnselectedRentableItemsBanner = this.areInvalidRentableItemsSelected(this.unavailableRentableItemsSelectedMap);
    this.setState({ shouldDisplayUnselectedRentableItemsBanner });
  };

  @action
  handleNoRentableItemsSelected = (value, feeId) => {
    this.noRentableItemsSelectedMap[feeId] = value;
  };

  shouldDisableLeaseFormSubmitButton = additionalLeaseData => {
    if (this.state.unavailableToLease || !additionalLeaseData) return true;

    const { leaseFormDirty, draftLease } = this.props;
    if (draftLease) return false;

    return !leaseFormDirty;
  };

  render() {
    const {
      dlgLeaseForm,
      unitName,
      readOnlyLease,
      isCorporateParty,
      leaseFormData: formData,
      promotedQuote = {},
      partyMembers,
      party,
      additionalLeaseData,
      isRenewal,
      activeLeaseWorkflowData,
      allActiveLeases,
    } = this.props;
    const {
      areAdditionalChargesUnchecked,
      areConcessionsUnchecked,
      areOneTimeChargesUnchecked,
      shouldDisplayUnselectedRentableItemsBanner,
      termLengthOverride,
      showPartyRepresentativeErrorMessage,
    } = this.state;

    const leaseFormData = formData ? { ...formData } : {};
    const { baselineData: { timezone, publishedLease } = {} } = leaseFormData ? { ...leaseFormData } : {};
    const partyMembersExcludingOccupants = partyMembers ? partyMembers.toArray().filter(p => p.memberType !== DALTypes.MemberType.OCCUPANT) : [];

    if (termLengthOverride) {
      const publishedTerm = additionalLeaseData.publishedTerm;
      additionalLeaseData.publishedTerm = {
        ...publishedTerm,
        originalTermLength: publishedTerm.originalTermLength || publishedTerm.termLength,
        termLength: termLengthOverride,
      };

      if (publishedLease) {
        leaseFormData.baselineData = {
          ...leaseFormData.baselineData,
          publishedLease: {
            ...leaseFormData.baselineData.publishedLease,
            termLength: termLengthOverride,
          },
        };
      }
    }

    const { doesLeaseProviderHandleEDocuments, leaseProviderLoginUrl } = this.doesLeaseProviderHandleEDocuments(promotedQuote?.inventory?.property?.id);
    return (
      <div>
        {Object.keys(leaseFormData || {}).length === 0 || Object.keys(additionalLeaseData || {}).length === 0 ? (
          <FullScreenDialog
            id="leaseForm"
            open={dlgLeaseForm.isOpen}
            title={
              <DialogTitle>
                <span data-id="leaseFormTitle">
                  {t('LEASE_FORM_MODAL_TITLE', {
                    unitName,
                  })}
                </span>
              </DialogTitle>
            }>
            <PreloaderBlock size="big" />
          </FullScreenDialog>
        ) : (
          dlgLeaseForm.isOpen && (
            <FullScreenDialog
              id="leaseForm"
              open={dlgLeaseForm.isOpen}
              title={
                <DialogTitle>
                  <span data-id="leaseFormTitle">
                    {t('LEASE_FORM_MODAL_TITLE', {
                      unitName,
                    })}
                  </span>
                </DialogTitle>
              }
              actions={
                <DialogHeaderActions>
                  {do {
                    if (readOnlyLease) {
                      <DownloadLeaseButton downloadLeaseDocument={this.handleDownloadLease} leaseId={leaseFormData.id} />;
                    } else if (leaseFormData && additionalLeaseData) {
                      <LeaseFormSubmitButton
                        disabled={this.shouldDisableLeaseFormSubmitButton(additionalLeaseData)}
                        allowRentableItemSelection={this.props.allowRentableItemSelection}
                        exportEnabled={this.isExportEnabledForProperty(promotedQuote.inventory.property.id)}
                        publishStatus={this.props.publishStatus}
                        additionalLeaseData={additionalLeaseData}
                      />;
                    }
                  }}
                </DialogHeaderActions>
              }
              onCloseRequest={() => this.handleCloseLeaseFormDialog(readOnlyLease)}>
              <div>
                <LeaseForm
                  activeLeases={allActiveLeases.toArray()}
                  lease={leaseFormData}
                  readOnly={readOnlyLease}
                  onPublish={this.handlePublishLease}
                  onLeaseTermLengthChanged={this.handleLeaseTermLengthChanged}
                  additionalData={additionalLeaseData}
                  isCorporateParty={isCorporateParty}
                  timezone={timezone || promotedQuote.propertyTimezone}
                  partyMembers={partyMembers ? partyMembers.toArray() : []}
                  applicationSettings={this.getApplicationSettingsForProperty(promotedQuote.inventory.property.id)}
                  exportEnabled={this.isExportEnabledForProperty(promotedQuote.inventory.property.id)}
                  displayContractDocuments={!doesLeaseProviderHandleEDocuments}
                  setLeaseAvailability={this.setLeaseAvailability}
                  party={party}
                  onAddEmailAddress={this.handleAddEmailAddress}
                  isRenewal={isRenewal}
                  activeLeaseWorkflowData={activeLeaseWorkflowData}
                  handleCheckAdditionalCharges={this.handleCheckAdditionalCharges}
                  handleCheckConcessions={this.handleCheckConcessions}
                  handleCheckOneTimeCharges={this.handleCheckOneTimeCharges}
                  handleUnavailableRentableItemsSelected={this.handleUnavailableRentableItemsSelected}
                  handleNoRentableItemsSelected={this.handleNoRentableItemsSelected}
                  areAdditionalChargesUnchecked={areAdditionalChargesUnchecked}
                  areConcessionsUnchecked={areConcessionsUnchecked}
                  areOneTimeChargesUnchecked={areOneTimeChargesUnchecked}
                  termLengthOverride={termLengthOverride}
                  updatePartyRepresentative={this.updatePartyRepresentative}
                  showPartyRepresentativeErrorMessage={showPartyRepresentativeErrorMessage}
                  shouldDisplayUnselectedRentableItemsBanner={shouldDisplayUnselectedRentableItemsBanner}
                  showPartyRepresentativeSelector={this.shouldDisplayPartyRepresentativeSelection(promotedQuote.inventory.property.id)}
                />
                <PublishLeaseDialog
                  lease={leaseFormData}
                  quote={promotedQuote}
                  partyMembers={partyMembersExcludingOccupants}
                  closeLeaseForm={this.handleCloseLeaseFormDialog}
                  doesLeaseProviderHandleEDocuments={doesLeaseProviderHandleEDocuments}
                  leaseProviderLoginUrl={leaseProviderLoginUrl}
                />
                {this.dlgDiscardEdits.isOpen && <DiscardEditsDialog open={this.dlgDiscardEdits.isOpen} onDiscardEdits={this.handleCloseDiscardEditsDialog} />}
              </div>
            </FullScreenDialog>
          )
        )}
        {this.dlgInventoryHoldingWarning.isOpen && (
          <InventoryHoldingWarningDialog isOpen={this.dlgInventoryHoldingWarning.isOpen} model={this.inventoryHoldingWarningDialogModel} />
        )}
        {this.dlgInvalidEmailWarning.isOpen && (
          <InvalidEmailWarningDialog
            open={this.dlgInvalidEmailWarning.isOpen}
            onAddEmailAddress={() => this.handleAddEmailAddress(this.membersWithInvalidEmail.map(pm => pm.id))}
            onCloseDialog={this.onInvalidEmailWarningDialogClosed}
          />
        )}
        {this.dlgReviewChargesDialog.isOpen && (
          <MsgBox
            open={this.dlgReviewChargesDialog.isOpen}
            lblOK={t('')}
            lblCancel={t('CLOSE')}
            btnCancelRole={'secondary'}
            title={t('REVIEW_CONCESSIONS_AND_CHARGES_TITLE')}
            onCloseRequest={this.onReviewChargesDialogClosed}>
            <T.Text>{t('REVIEW_CONCESSIONS_AND_CHARGES_MESSAGE1')}</T.Text>
          </MsgBox>
        )}
        {this.dlgUnavailableRentableItemsSelected.isOpen && (
          <MsgBox
            open={this.dlgUnavailableRentableItemsSelected.isOpen}
            lblOK={t('OK_GOT_IT')}
            lblCancel={t('')}
            title={t('CANNOT_PUBLISH_LEASE')}
            onOKClick={this.onUnavailableRentableItemsSelectedDialogClosed}
            content={t('UNAVAILABLE_RENTABLE_ITEMS_SELECTED_CONTENT')}
            onCloseRequest={this.onUnavailableRentableItemsSelectedDialogClosed}
          />
        )}
        {this.dlgNoPartyRepresentativeSelected.isOpen && (
          <MsgBox
            open={this.dlgNoPartyRepresentativeSelected.isOpen}
            lblOK={t('OK_GOT_IT')}
            lblCancel={t('')}
            title={t('CANNOT_PUBLISH_LEASE')}
            onOKClick={this.onNoPartyRepresentativeSelectedDialogClosed}
            content={t('NO_PARTY_REPRESENTATIVE_SELECTED_MESSAGE')}
            onCloseRequest={this.onNoPartyRepresentativeSelectedDialogClosed}
          />
        )}
        {this.dlgWetSignedNotAvailableForDownload.isOpen && this.renderWetSignedNotAvailableForDownloadDialog()}
      </div>
    );
  }
}

export default connect(
  (state, props) => {
    // CHECK: why do we need all the quotes? are these quotes only tied to a given party?
    const { quotes } = state.quotes;
    const hasQuotes = quotes && quotes.length && quotes.some(quote => !quote.pristine);
    const quotePromotion = getActiveQuotePromotion(state, props);
    const promotedQuotes = getPromotedQuotes(state, props);
    const allActiveLeases = getActiveLeases(state, props);

    const promotedQuote = hasQuotes && quotePromotion ? getQuoteByQuoteId(promotedQuotes, quotePromotion.quoteId) : undefined;

    return {
      allActiveLeases,
      quotes,
      userToken: state.auth.token,
      leasingProviderMode: (state.auth.user || {}).leasingProviderMode,
      leaseFormData: getLeaseFormData(state, props),
      additionalLeaseData: state.leaseStore.additionalData,
      publishStatus: state.leaseStore.publishStatus,
      unitName: getUnitNameForSelectedLease(state, props),
      readOnlyLease: isReadOnlyLease(state, props),
      leaseHasDigitallySignedDocument: doesLeaseHaveDigitallySignedDocument(state, props),
      leaseHasWetSignedEnvelope: doesLeaseHaveWetSignedEnvelope(state, props),
      draftLease: isDraftLease(state, props),
      leaseFormDirty: isDirty('leaseForm')(state),
      promotedQuotes,
      quotePromotion,
      promotedQuote,
      allowRentableItemSelection: getAllowRentableItemSelection(state),
    };
  },
  dispatch =>
    bindActionCreators(
      {
        downloadLeaseDocument,
        publishLease,
        fetchLeaseAdditionalData,
        clearLeaseAdditionalData,
      },
      dispatch,
    ),
)(inject('leasingNavigator')(observer(LeaseFormDialogWrapper)));
