/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import {
  voidLease,
  fetchLeaseStatus,
  fetchLeaseAdditionalData,
  clearLeaseAdditionalData,
  closeInitiateESignatureRequestDialog,
  markAsWetSigned,
  syncLeaseSignatures,
} from 'redux/modules/leaseStore';
import { getLayoutSummary } from 'helpers/inventory';
import { RedTable, Typography as T, Button, Section, SectionTitle, CardMenu, CardMenuItem, MsgBox, FormattedMarkdown, PreloaderBlock } from 'components';
import LeaseMembersAndEmailsChangedWarning from 'custom-components/SummaryWarnings/LeaseMembersAndEmailsChangedWarning';
import { getActiveQuotePromotion, getPartyVehicles, getPartyPets, getAssociatedPropertySettingsForParty } from 'redux/selectors/partySelectors';
import { windowOpen } from 'helpers/win-open';
import { Divider } from 'components/CardMenu/CardMenuIndex';
import { DALTypes } from '../../../common/enums/DALTypes';
import { formatDateAgo } from '../../../common/helpers/date-utils';
import {
  getShortFormatRentableItem,
  getMatchingResultsSorted,
  doesScreeningResultChangedAfterPromotion,
  isScreeningResultIncomplete,
} from '../../../common/helpers/quotes';
import {
  checkHasLeaseStarted,
  getMembersWithModifiedNames,
  hasPartyMemberNumberChanged,
  getMembersWithModifiedEmails,
  shouldShowLeaseWarningCheck,
  getMembersWithModifiedCompanyName,
  isSignatureStatusSigned,
  allMembersWetSignedByEnvelopeId,
} from '../../../common/helpers/lease';
import LeaseStatusCard from './LeaseStatusCard';
import CounterSignerWarning from './CounterSignerWarning';
import { cf } from './LeaseStatusSection.scss';
import { LeaseStartWarning } from '../../custom-components/SummaryWarnings/LeaseStartWarning';
import { getInventoryAvailability } from '../../redux/selectors/inventorySelectors';
import { displayVoidLeaseOption } from '../../redux/selectors/leaseSelectors';
import DemoteDialog from '../ProspectDetailPage/Applications/DemoteDialog';
import { InventoryHoldingWarningDialog } from '../Quotes/InventoryHoldingWarningDialog';
import { isInventoryLeasedOnPartyType } from '../../../common/helpers/inventory';
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import { toMoment } from '../../../common/helpers/moment-utils';
import { IncompleteInfoWarning } from '../../custom-components/SummaryWarnings/IncompleteInfoWarning';
import { isBlueMoonLeasingProviderMode } from '../../../common/helpers/utils';
import LeaseDateWarningDialog from './LeaseDateWarningDialog';

const { Table, GroupTitle, Money } = RedTable;
const { Text } = T;

const getUnit = createSelector(
  props => props.quote,
  quote => (quote ? getShortFormatRentableItem(quote.inventory) : ''),
);
@connect(
  (state, props) => {
    const quotePromotion = getActiveQuotePromotion(state, props) || {};
    const leaseTerm = (props.quote || {}).leaseTerms.find(lt => lt.id === quotePromotion.leaseTermId) || {};
    const { lease } = props;
    const { baselineData: { timezone } = {} } = lease || {};
    const hasLeaseStarted = checkHasLeaseStarted(lease, timezone);
    const newProps = { ...props, partyId: lease.partyId };
    return {
      partyId: lease.partyId,
      inventory: state.inventoryStore.inventory,
      unit: getUnit(props),
      quotePromotion,
      leaseTerm,
      inventoryAvailability: getInventoryAvailability(state, props),
      hasLeaseStarted,
      shouldDisplayVoidLease: displayVoidLeaseOption(state, props),
      user: state.auth.user,
      partyVehicles: getPartyVehicles(state, newProps),
      partyPets: getPartyPets(state, newProps),
      propertySettings: getAssociatedPropertySettingsForParty(state, newProps),
      leasingProviderMode: (state.auth.user || {}).leasingProviderMode,
      leaseSyncInProgress: state.leaseStore.leaseSyncInProgress,
    };
  },
  dispatch =>
    bindActionCreators(
      {
        voidLease,
        fetchLeaseStatus,
        fetchLeaseAdditionalData,
        clearLeaseAdditionalData,
        closeInitiateESignatureRequestDialog,
        markAsWetSigned,
        syncLeaseSignatures,
      },
      dispatch,
    ),
)
export default class LeaseStatusSection extends Component {
  static propTypes = {
    lease: PropTypes.object,
    quote: PropTypes.object,
    persons: PropTypes.object,
    party: PropTypes.object,
    users: PropTypes.object,
    loadingInventoryDetails: PropTypes.func,
    onReviewLease: PropTypes.func,
    voidLease: PropTypes.func,
    fetchLeaseStatus: PropTypes.func,
    handleOpenManageParty: PropTypes.func,
    isRenewal: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      isVoidLeaseDialogOpen: false,
      isCounterSignWarningOpen: false,
      isDemoteApplicationDialogOpen: false,
      isLeaseDateWarningDialogOpen: false,
      isInventoryHoldingWarningOpen: false,
      isInitiateESignatureRequestDialogOpen: false,
      isWetCounterSignDialogOpen: false,
      isCounterSignUpdatedDialogOpen: false,
      isCannotESignLeaseDialogOpen: false,
      loadingLease: false,
      leaseDateWarningDialogContent: t('PAST_LEASE_START_DATE_WARNING_CONTENT'),
      isMarkAsWetSignedDialogOpen: false,
      isMarkAsWetSignedForGuarantorsDialogOpen: false,
      markAsWetSignedLeaseId: null,
      markAsWetSignedSignature: null,
      oldCounterSignature: null,
    };
  }

  handleOpenVoidLease = () => {
    this.setState({
      isVoidLeaseDialogOpen: true,
    });
  };

  handleOpenMarkAsWetSignedDialog = (leaseId, signature) => {
    this.setState({
      isMarkAsWetSignedDialogOpen: true,
      markAsWetSignedLeaseId: leaseId,
      markAsWetSignedSignature: signature,
    });
  };

  handleCloseMarkAsWetSignedDialog = () => {
    this.setState({
      isMarkAsWetSignedDialogOpen: false,
      markAsWetSignedLeaseId: null,
      markAsWetSignedSignature: null,
    });
  };

  handleOpenMarkAsWetSignedForGuarantorsDialog = (leaseId, signature) => {
    this.setState({
      isMarkAsWetSignedForGuarantorsDialogOpen: true,
      markAsWetSignedLeaseId: leaseId,
      markAsWetSignedSignature: signature,
    });
  };

  handleCloseMarkAsWetSignedForGuarantorsDialog = () => {
    this.setState({
      isMarkAsWetSignedForGuarantorsDialogOpen: false,
      markAsWetSignedLeaseId: null,
      markAsWetSignedSignature: null,
    });
  };

  handleMarkAsWetSigned = () => {
    const { partyId } = this.props.lease;
    this.props.markAsWetSigned(partyId, this.state.markAsWetSignedLeaseId, this.state.markAsWetSignedSignature);
  };

  handleFetchLeaseStatus = () => {
    const { partyId, id } = this.props.lease;
    this.leaseSectionMenu.close();
    this.props.fetchLeaseStatus && this.props.fetchLeaseStatus(partyId, id);
  };

  handleEditLease = () => {
    const { onReviewLease, lease } = this.props;
    lease && onReviewLease && onReviewLease(lease);
  };

  handleReviewLease = async () => {
    const { lease } = this.props;
    const { partyId, id } = lease;

    this.setState({ loadingLease: true });
    await this.props.clearLeaseAdditionalData();
    await this.props.fetchLeaseAdditionalData(partyId, id);
    this.setState({ loadingLease: false });
    if (lease.status === DALTypes.LeaseStatus.DRAFT) {
      this.handleEditLease();
    } else {
      this.setState({
        isEditLeaseDialogOpen: true,
      });
    }
  };

  redirectToSignUrl = signUrl => windowOpen(signUrl, '_blank');

  handleCounterSign = signUrl => {
    const { screeningSummary = {}, quotePromotion, leaseTerm, party, quote, hasLeaseStarted, user = {} } = this.props;

    const { screeningRequired } = party;
    const matchingResults = screeningRequired && getMatchingResultsSorted(quotePromotion, leaseTerm, screeningSummary.screeningResults);

    const hasApplicationStatusChanged = screeningRequired ? doesScreeningResultChangedAfterPromotion(quotePromotion, matchingResults) : false;
    const isScreeningIncomplete = screeningRequired ? isScreeningResultIncomplete(matchingResults) : false;
    const shouldDisplayLeaseDateWarningDialog = hasLeaseStarted && !user?.allowCounterSigningInPast;

    const shouldDisplayCounterSignWarning = !shouldDisplayLeaseDateWarningDialog && (hasApplicationStatusChanged || isScreeningIncomplete);

    const isInventoryReservedOrOccupied = isInventoryLeasedOnPartyType(quote?.inventory?.state, party);
    const shouldDisplayInventoryHoldingWarning = isInventoryReservedOrOccupied && !shouldDisplayCounterSignWarning;

    if (!shouldDisplayCounterSignWarning && !shouldDisplayLeaseDateWarningDialog) {
      this.redirectToSignUrl(signUrl);
      return;
    }

    this.setState(prevState => ({
      isCounterSignWarningOpen: shouldDisplayCounterSignWarning,
      isLeaseDateWarningDialogOpen: shouldDisplayLeaseDateWarningDialog,
      signUrl,
      hasApplicationStatusChanged,
      isInventoryHoldingWarningOpen: shouldDisplayInventoryHoldingWarning,
      leaseDateWarningDialogContent: prevState.leaseDateWarningDialogContent,
    }));
  };

  updateOldCounterSignature = (signature = null) => this.setState({ oldCounterSignature: signature });

  handleCounterSignLease = signature => {
    const { leasingProviderMode, lease, party } = this.props;
    const { signatures = [], id: leaseId } = lease;
    const { signUrl } = signature;

    const isBlueMoonLeasingMode = isBlueMoonLeasingProviderMode(leasingProviderMode);
    if (isBlueMoonLeasingMode) {
      const isWetCounterSign = allMembersWetSignedByEnvelopeId(signature.envelopeId, signatures);
      if (isWetCounterSign) {
        this.setState({ isWetCounterSignDialogOpen: true, markAsWetSignedSignature: signature, markAsWetSignedLeaseId: leaseId });
      } else {
        this.updateOldCounterSignature(signature);
        this.props.syncLeaseSignatures(lease.id, party.id, signature.clientUserId);
      }
      return;
    }

    this.handleCounterSign(signUrl);
  };

  handleViewLease = () => {
    const { onReviewLease, lease } = this.props;
    onReviewLease && onReviewLease(lease);
  };

  handleVoidLease = () => {
    const { party, lease } = this.props;
    this.props.voidLease(party.id, lease.id);
  };

  handleOpenDemoteApplicationDialog = () => {
    this.setState({
      isDemoteApplicationDialogOpen: true,
    });
  };

  handleCloseDemoteApplicationDialog = () => {
    this.setState({
      isDemoteApplicationDialogOpen: false,
    });
  };

  handleOpenInitiateESignatureRequestDialog = () => {
    this.setState({
      isInitiateESignatureRequestDialogOpen: true,
    });
  };

  handleCloseInitiateESignatureRequestDialog = () => {
    this.setState({
      isInitiateESignatureRequestDialogOpen: false,
    });
    this.props.closeInitiateESignatureRequestDialog();
  };

  handleOpenCannotESignLeaseDialog = () => {
    this.setState({
      isCannotESignLeaseDialogOpen: true,
    });
  };

  handleOpenRenewalLetterInNewTab = quoteId => {
    if (!quoteId) return;
    const urlPublishedQuote = `${window.location.protocol}//${window.location.host}/publishedQuote/${quoteId}`;
    windowOpen(urlPublishedQuote, '_blank');
  };

  getLeaseSectionUnitText = unit => (this.props.isRenewal ? t('RENEWAL_LEASE_SECTION_UNIT', { unit }) : t('LEASE_SECTION_UNIT', { unit }));

  getLeaseSectionPublishingUnitText = unit =>
    this.props.isRenewal ? t('PUBLISHING_RENEWAL_LEASE_SECTION_UNIT', { unit }) : t('PUBLISHING_LEASE_SECTION_UNIT', { unit });

  renderVoidedLeaseState = () => {
    const voidLeaseC = this.renderVoidedLease();
    const { unit, lease, hasLeaseStarted } = this.props;
    const menuId = 'leaseForUnit_menu';

    return (
      <Section
        data-id="leaseVoidedForUnitSection"
        title={
          <div>
            <SectionTitle className={cf('no-margin-bottom')} actionItems={this.renderMenu(lease.status, hasLeaseStarted, menuId)}>
              <T.Text bold inline>
                {this.getLeaseSectionUnitText(unit)}
              </T.Text>
            </SectionTitle>
            {this.renderMissingAdditionalItemInfo()}
          </div>
        }>
        <T.SubHeader disabled>{t('LEASE_SECTION_EMPTY_STATE')}</T.SubHeader>
        {voidLeaseC && voidLeaseC}
      </Section>
    );
  };

  getTitleInfo = () => {
    const { quote } = this.props;
    return quote?.inventory?.name || '';
  };

  isThereMissingVehicleInfo = (vehicles = []) => !vehicles.every(({ info: { makeAndModel, tagNumber, state } }) => makeAndModel && tagNumber && state);

  isThereMissingPetInfo = (pets = []) => !pets.every(({ info: { name, type, breed, size } }) => name && type && breed && size);

  renderMissingAdditionalItemInfo = () => {
    const { partyVehicles = [], partyPets = [], handleOpenManageParty } = this.props;
    return (
      <div>
        {this.isThereMissingVehicleInfo(partyVehicles) && (
          <IncompleteInfoWarning
            content={t('INCOMPLETE_ITEM_INFO_FULL_MSG', { item: t('VEHICLE').toLowerCase() })}
            handleOpenManageParty={handleOpenManageParty}
          />
        )}
        {this.isThereMissingPetInfo(partyPets) && (
          <IncompleteInfoWarning content={t('INCOMPLETE_ITEM_INFO_FULL_MSG', { item: t('PET').toLowerCase() })} handleOpenManageParty={handleOpenManageParty} />
        )}
      </div>
    );
  };

  renderLeaseHeaderWithButton = (headerText, buttonText, buttonHandler) => {
    const {
      quotePromotion,
      unit,
      inventoryAvailability: { isInventoryUnavailable, inventoryAvailableDate },
      lease,
      hasLeaseStarted,
      isRenewal,
    } = this.props;

    const { isDemoteApplicationDialogOpen, loadingLease } = this.state;
    const menuId = 'leaseForUnit_menu';

    return (
      <div>
        {loadingLease && (
          <Section
            data-id="leaseForUnitSection"
            title={
              <div>
                <SectionTitle className={cf('no-margin-bottom')}>
                  <T.Text bold inline>
                    {this.getLeaseSectionPublishingUnitText(unit)}
                  </T.Text>
                </SectionTitle>
              </div>
            }>
            <div className={cf('lease-description')}>
              <Text inline>{t('PUBLISHING_LEASE_LOADING_TEXT')}</Text>
              <PreloaderBlock size="tiny" />
            </div>
          </Section>
        )}

        {!loadingLease && (
          <Section
            data-id="leaseForUnitSection"
            title={
              <div>
                <SectionTitle className={cf('no-margin-bottom')} actionItems={<div>{this.renderMenu(lease.status, hasLeaseStarted, menuId)}</div>}>
                  <T.Text bold inline>
                    {this.getLeaseSectionUnitText(unit)}
                  </T.Text>
                </SectionTitle>
                {isInventoryUnavailable && (
                  <LeaseStartWarning content={t('UNIT_NOT_AVAILABLE_TO_LEASE_WARNING', { name: this.getTitleInfo(), date: inventoryAvailableDate })} />
                )}
                {this.renderMissingAdditionalItemInfo()}
              </div>
            }>
            <div className={cf('lease-header')}>
              <div>
                <T.SubHeader disabled data-id="leaseStateTxt">
                  {headerText}
                </T.SubHeader>
              </div>
            </div>
            {this.renderDescription(this.props.lease)}
            <div className={cf('lease-actions-container')}>
              <Button id="reviewLeaseBtn" btnRole="primary" label={buttonText} onClick={buttonHandler} />
            </div>
            {!isRenewal ? (
              <DemoteDialog
                leaseStatus={lease.status}
                quotePromotion={quotePromotion}
                isDemoteApplicationDialogOpen={isDemoteApplicationDialogOpen}
                onDialogClosed={this.handleCloseDemoteApplicationDialog}
                hasALease={true}
                dialogTitle={t('VOID_LEASE')}
              />
            ) : (
              this.renderVoidLeaseDialog(false)
            )}
          </Section>
        )}
      </div>
    );
  };

  renderMenu = (leaseStatus, hasLeaseStarted, menuId = '') => {
    const {
      shouldDisplayVoidLease,
      isRenewal,
      propertySettings,
      lease: { quoteId },
    } = this.props;
    const isLeaseExecuted = leaseStatus === DALTypes.LeaseStatus.EXECUTED;
    const isLeaseVoided = leaseStatus === DALTypes.LeaseStatus.VOIDED;
    const isLeaseDraft = leaseStatus === DALTypes.LeaseStatus.DRAFT;

    if (isLeaseVoided) return <noscript />;

    if (isLeaseDraft) {
      return (
        <CardMenu iconName="dots-vertical">
          <CardMenuItem
            text={t('VOID_LEASE')}
            onClick={!isRenewal ? this.handleOpenDemoteApplicationDialog : this.handleOpenVoidLease}
            id="abandonRequestApproval"
          />
        </CardMenu>
      );
    }

    return (
      <CardMenu
        id={menuId}
        ref={leaseMenu => {
          this.leaseSectionMenu = leaseMenu;
        }}
        iconName="dots-vertical">
        {isLeaseExecuted ? (
          <div data-id="executedLeaseOptions">
            <CardMenuItem id="viewLeaseOption" onClick={this.handleViewLease} text={t('VIEW_LEASE')} />
            {shouldDisplayVoidLease && <CardMenuItem id="voidLeaseOption" onClick={this.handleOpenVoidLease} text={t('VOID_LEASE')} />}
          </div>
        ) : (
          <div data-id="leaseOptions">
            <CardMenuItem id="editLeaseOption" onClick={this.handleReviewLease} text={t('VIEW_EDIT_LEASE')} />
            {shouldDisplayVoidLease && <CardMenuItem id="voidLeaseOption" onClick={this.handleOpenVoidLease} text={t('VOID_LEASE')} />}
            <CardMenuItem onClick={this.handleFetchLeaseStatus} text={t('FETCH_LEASE_STATUS')} />
            {isRenewal && (
              <div>
                <Divider />
                <CardMenuItem id="openRenewalLetter" onClick={() => this.handleOpenRenewalLetterInNewTab(quoteId)} text={t('VIEW_RELATED_RENEWAL_LETTER')} />
              </div>
            )}
            {!!propertySettings?.lease?.leaseProviderLoginUrl && (
              <div>
                <Divider />
                <CardMenuItem
                  id="openLeaseProviderWebsite"
                  onClick={() => windowOpen(propertySettings?.lease?.leaseProviderLoginUrl)}
                  text={t('GO_TO_BLUEMOON')}
                />
              </div>
            )}
          </div>
        )}
      </CardMenu>
    );
  };

  renderComplimentaryItems = quote => {
    const inventory = quote.inventory;

    let complimentaryItems = '';
    if (inventory.complimentaryItems) {
      complimentaryItems = inventory.complimentaryItems.map(ci => `1 ${ci.name.toLowerCase()}`).join(', ');
    }
    const layoutInf = getLayoutSummary(inventory);
    return (
      <div className={cf('inline')} data-id="complimentaryItems" data-layout={layoutInf}>
        <Text data-id="leaseComplimentaryItemsTxt" inline>
          {`. ${t('THIS_LEASE_INCLUDES', { layoutInf })}${complimentaryItems ? ',' : ''}`}
        </Text>
        <Text inline>{complimentaryItems || <noscript />}</Text>
      </div>
    );
  };

  getUnitRent = (lease, term) => {
    const { publishedLease } = lease.baselineData;
    return publishedLease ? publishedLease.unitRent : term.adjustedMarketRent;
  };

  getLeaseTermLength = (lease, term) => {
    const { publishedLease } = lease.baselineData;
    return publishedLease?.termLength || term.termLength;
  };

  renderLeaseCreatedOrExecutedDate = (isLeaseExecuted, leaseDate, timezone) => {
    const date = formatDateAgo(leaseDate, timezone);
    const lowerCaseDate = formatDateAgo(leaseDate, timezone).toLowerCase();
    const dateMessage = t('DATETIME_TODAY') === date ? lowerCaseDate : date;
    const translationToken = isLeaseExecuted ? 'WAS_EXECUTED' : 'WAS_CREATED';
    return (
      <Text inline>
        <Text inline>{` ${t(translationToken)}`}</Text>
        <Text inline bold data-id="createdAt">{` ${dateMessage}.`}</Text>
      </Text>
    );
  };

  renderDescription = () => {
    const { lease, quote, isRenewal } = this.props;
    if (!lease || !quote) return <div />;

    const isLeaseExecuted = lease.status === DALTypes.LeaseStatus.EXECUTED;
    const term = quote.leaseTerms.find(lt => lt.id === lease.leaseTermId);
    const leaseDate = isLeaseExecuted ? lease.signDate : lease.created_at;
    const amount = this.getUnitRent(lease, term);
    const termLength = this.getLeaseTermLength(lease, term);

    const { baselineData: { timezone, publishedLease } = {} } = lease;

    const { leaseStartDate: publishedLeaseStartDate, leaseEndDate } = publishedLease || {};

    const { leaseStartDate: quoteLeaseStartDate } = quote;
    const leaseStartDateWithoutTimezone = publishedLeaseStartDate || quoteLeaseStartDate;
    const leaseStartDate = toMoment(leaseStartDateWithoutTimezone, { timezone }).format(MONTH_DATE_YEAR_FORMAT);
    return (
      <div className={cf('lease-description')} data-id="leaseDescription">
        <Text inline>{' A '}</Text>
        <Text inline bold data-id="leaseTerm">
          {' '}
          {` ${termLength} ${term.period} `}{' '}
        </Text>
        <Text inline>{isRenewal ? t('RENEWAL_FOR_UNIT') : t('LEASE_FOR_UNIT')}</Text>
        <Text inline bold data-id="unitShortHand">{` ${getShortFormatRentableItem(quote.inventory)} `}</Text>
        <Text inline>{` ${t('AT')} `}</Text>
        <Money amount={amount} currency="USD" data-id="baseRentInLeaseStatusText" />
        <Text inline>{'/mo'}</Text>
        {this.renderLeaseCreatedOrExecutedDate(isLeaseExecuted, leaseDate, timezone)}
        <Text inline>
          {isLeaseExecuted
            ? ` ${t('PARTY_LEASE_SECTION_DESCRIPTION_SECOND_PART', {
                leaseStartDate,
                leaseEndDate: toMoment(leaseEndDate, { timezone }).format(MONTH_DATE_YEAR_FORMAT),
              })} `
            : ` ${t('PARTY_LEASE_DRAFT_SECTION_DESCRIPTION_SECOND_PART', { leaseStartDate })} `}
        </Text>
      </div>
    );
  };

  membersWithModifiedNames = (lease, party) => getMembersWithModifiedNames(lease, party.partyMembers);

  memberCountChanged = (lease, party) => hasPartyMemberNumberChanged(lease, party.partyMembers);

  membersWithChangedEmails = (lease, party) => getMembersWithModifiedEmails(lease, party.partyMembers);

  membersWithModifiedCompanyName = (lease, party) =>
    party.leaseType === DALTypes.LeaseType.CORPORATE ? getMembersWithModifiedCompanyName(lease, party.partyMembers) : [];

  renderMembersModifiedNotification = () => {
    const { lease, party } = this.props;
    return (
      <LeaseMembersAndEmailsChangedWarning
        partyMembersWithModifiedName={this.membersWithModifiedNames(lease, party)}
        partyMembersWithModifiedEmail={this.membersWithChangedEmails(lease, party)}
        partyMemberCountChanged={this.memberCountChanged(lease, party)}
        partyMembersWithModifiedCompanyName={this.membersWithModifiedCompanyName(lease, party)}
      />
    );
  };

  shouldShowLeaseWarning = () => {
    const { lease, party } = this.props;
    return shouldShowLeaseWarningCheck(lease, party);
  };

  renderSubmittedState = wasLeaseSent => {
    const {
      unit,
      lease,
      hasLeaseStarted,
      inventoryAvailability: { isInventoryUnavailable, inventoryAvailableDate },
    } = this.props;

    const menuId = 'leaseForUnit_menu';

    return (
      <div>
        <Section
          title={
            <div>
              <SectionTitle className={cf('no-margin-bottom')} actionItems={<div>{this.renderMenu(lease.status, hasLeaseStarted, menuId)}</div>}>
                <T.Text bold inline>
                  {this.getLeaseSectionUnitText(unit)}
                </T.Text>
              </SectionTitle>
              {isInventoryUnavailable && (
                <LeaseStartWarning content={t('UNIT_NOT_AVAILABLE_TO_LEASE_WARNING', { name: this.getTitleInfo(), date: inventoryAvailableDate })} />
              )}
              {this.renderMissingAdditionalItemInfo()}
              {this.shouldShowLeaseWarning() && this.renderMembersModifiedNotification()}
            </div>
          }>
          <div className={cf('lease-header')}>
            <div>
              <T.SubHeader secondary data-id="leaseStateTxt">
                {t('LEASE_NOT_SENT_FOR_SIGNATURES_YET')}
              </T.SubHeader>
            </div>
          </div>
          {this.renderDescription()}
          {this.renderTable()}
        </Section>
        {this.renderVoidLeaseDialog(wasLeaseSent)}
        {this.renderEditLeaseDialog()}
        {this.renderInitiateESignatureRequestDialog()}
        {this.renderMarkAsWetSignedDialog()}
        {this.renderWetCounterSignDialog()}
        {this.renderCounterSignUpdatedDialog()}
        {this.renderCannotESignLeaseDialog()}
        {this.renderSyncInProgressDialog()}
        {this.renderMarkAsWetSignedForGuarantorsDialog()}
      </div>
    );
  };

  renderDraftState = () => <div>{this.renderLeaseHeaderWithButton(t('LEASE_CREATED'), t('REVIEW_LEASE'), this.handleReviewLease)}</div>;

  renderPartyMembersCards = (groupTitle, memberType) => {
    const { party, persons, lease, quote, propertySettings, leasingProviderMode } = this.props;
    const signatures = lease.signatures || [];
    const memberIds = signatures.map(signature => signature.partyMemberId).filter(memberId => memberId);
    const members = party.partyMembers.filter(pm => pm.memberType === memberType && memberIds.includes(pm.id));
    const isAResidentSignatureMarkedAsWetSigned = signatures
      .filter(signature => members.find(member => member.id === signature.partyMemberId))
      .find(signature => signature.status === DALTypes.LeaseSignatureStatus.WET_SIGNED);

    if (members.length) {
      return (
        <div key={`group-${members.map(member => member.id).join('_')}`}>
          <GroupTitle>{t(groupTitle)}</GroupTitle>
          {members.map((p, index) => (
            <LeaseStatusCard
              key={`${lease.id}-${p.personId}`}
              dataId={`${memberType.toLowerCase()}Row${index + 1}`}
              memberType={memberType}
              closeMarkAsWetSignedDialog={this.closeMarkAsWetSignedDialog}
              openMarkAsWetSignedDialog={this.handleOpenMarkAsWetSignedDialog}
              closeMarkAsWetSignedForGuarantorsDialog={this.closeMarkAsWetSignedForGuarantorsDialog}
              openMarkAsWetSignedForGuarantorsDialog={this.handleOpenMarkAsWetSignedForGuarantorsDialog}
              person={persons.get(p.personId)}
              lease={lease}
              party={party}
              quote={quote}
              signature={signatures.find(s => s.partyMemberId === p.id)}
              rowIndex={index + 1}
              propertySettings={propertySettings}
              openInitiateESignatureRequestDialog={this.handleOpenInitiateESignatureRequestDialog}
              openCannotESignLeaseDialog={this.handleOpenCannotESignLeaseDialog}
              leasingProviderMode={leasingProviderMode}
              isAResidentSignatureMarkedAsWetSigned={memberType === DALTypes.MemberType.RESIDENT && !!isAResidentSignatureMarkedAsWetSigned}
            />
          ))}
        </div>
      );
    }

    return <div />;
  };

  isReadyToCounterSign = (countersignerSignature, signatures) =>
    signatures.filter(s => s.partyMemberId && countersignerSignature.envelopeId === s.envelopeId).every(s => isSignatureStatusSigned(s.status));

  renderCountersignerCards = () => {
    const { oldCounterSignature } = this.state;
    const { lease, quote, users, propertySettings } = this.props;
    const signatures = lease.signatures || [];
    const countersignerSignatures = signatures.filter(s => s.userId);

    if (countersignerSignatures.length) {
      return (
        <div>
          <GroupTitle>{t('COUNTERSIGNER')}</GroupTitle>
          {countersignerSignatures.map((countersignerSignature, index) => {
            const countersigner = users.get(countersignerSignature.userId);
            const readyToCountersign = this.isReadyToCounterSign(countersignerSignature, signatures);

            return (
              <LeaseStatusCard
                countersignerRow
                key={`${lease.id}-${countersignerSignature.id}`}
                dataId="counterSignRow"
                readyToCountersign={readyToCountersign}
                person={countersigner}
                closeMarkAsWetSignedDialog={this.closeMarkAsWetSignedDialog}
                openMarkAsWetSignedDialog={this.handleOpenMarkAsWetSignedDialog}
                closeMarkAsWetSignedForGuarantorsDialog={this.closeMarkAsWetSignedForGuarantorsDialog}
                openMarkAsWetSignedForGuarantorsDialog={this.handleOpenMarkAsWetSignedForGuarantorsDialog}
                lease={lease}
                party={this.props.party}
                quote={quote}
                signature={countersignerSignature}
                onCounterSignClick={() => this.handleCounterSignLease(countersignerSignature)}
                oldCounterSignature={oldCounterSignature}
                updateOldCounterSignature={this.updateOldCounterSignature}
                handleCounterSign={this.handleCounterSign}
                handleOpenCounterSignDialogUpdated={this.handleOpenCounterSignDialogUpdated}
                rowIndex={index + 1}
                propertySettings={propertySettings}
              />
            );
          })}
        </div>
      );
    }

    return <div />;
  };

  renderTable = () => (
    <Table>
      {this.renderPartyMembersCards('RESIDENTS', DALTypes.MemberType.RESIDENT)}
      {this.renderPartyMembersCards('GUARANTORS', DALTypes.MemberType.GUARANTOR)}
      {this.renderCountersignerCards()}
    </Table>
  );

  renderVoidLeaseDialog = wasLeaseSent => {
    let msg = t('LEASE_VOID_MESSAGE');
    if (wasLeaseSent) msg = `${msg} ${t('LEASE_VOID_MESSAGE_NOTIFIED')}`;

    return (
      <MsgBox
        id="voidLeaseDialog"
        open={this.state.isVoidLeaseDialogOpen}
        ref="voidLeaseDialog"
        closeOnTapAway={false}
        lblOK={t('VOID')}
        onOKClick={this.handleVoidLease}
        title={t('LEASE_VOID_QUESTION')}
        onCloseRequest={() => this.setState({ isVoidLeaseDialogOpen: false })}>
        <div>
          <Text>{msg}</Text>
          <Text style={{ marginTop: '1rem' }}>{t('LEASE_VOID_CONFIRMATION')}</Text>
        </div>
      </MsgBox>
    );
  };

  renderMarkAsWetSignedDialog = () => (
    <MsgBox
      open={this.state.isMarkAsWetSignedDialogOpen}
      closeOnTapAway={false}
      title={t('MARK_AS_WET_SIGNED')}
      lblOK={t('MARK_AS_WET_SIGNED')}
      onClose={() => this.handleCloseMarkAsWetSignedDialog()}
      onOKClick={() => this.handleMarkAsWetSigned()}
      onCancelClick={() => this.handleCloseMarkAsWetSignedDialog()}>
      <FormattedMarkdown>{t('MARK_AS_WET_SIGNED_DETAILS')}</FormattedMarkdown>
    </MsgBox>
  );

  renderMarkAsWetSignedForGuarantorsDialog = () => (
    <MsgBox
      open={this.state.isMarkAsWetSignedForGuarantorsDialogOpen}
      closeOnTapAway={false}
      hideCancelButton={true}
      title={t('GUARANTOR_WET_SIGN_DIALOG_TITLE')}
      lblOK={t('OK_GOT_IT')}
      onClose={() => this.handleCloseMarkAsWetSignedForGuarantorsDialog()}
      onOKClick={() => this.handleCloseMarkAsWetSignedForGuarantorsDialog()}
      lblExtraButton={t('MARK_AS_WET_SIGNED')}
      onExtraButtonClick={() => this.handleMarkAsWetSigned()}>
      <FormattedMarkdown>{t('GUARANTOR_WET_SIGN_DIALOG_DETAILS')}</FormattedMarkdown>
    </MsgBox>
  );

  renderEditLeaseDialog = () => (
    <MsgBox
      id="editLeaseDialog"
      open={this.state.isEditLeaseDialogOpen}
      ref="editLeaseDialog"
      closeOnTapAway={false}
      lblOK={t('ACCEPT_LEASE_EDIT_WARNING')}
      onOKClick={this.handleEditLease}
      title={t('VIEW_EDIT_LEASE')}
      onCloseRequest={() => this.setState({ isEditLeaseDialogOpen: false })}>
      <FormattedMarkdown>{t('LEASE_EDIT_WARNING')}</FormattedMarkdown>
    </MsgBox>
  );

  renderInitiateESignatureRequestDialog = () => {
    const { propertySettings } = this.props;

    return (
      <MsgBox
        id="initiateESignatureRequestDialog"
        open={this.state.isInitiateESignatureRequestDialogOpen}
        ref="initiateESignatureRequestDialog"
        closeOnTapAway={false}
        lblOK={t('GO_TO_BLUEMOON')}
        lblCancel={t('OK_GOT_IT')}
        onOKClick={() => {
          windowOpen(propertySettings?.lease?.leaseProviderLoginUrl);
          this.handleCloseInitiateESignatureRequestDialog();
        }}
        onCloseRequest={this.handleCloseInitiateESignatureRequestDialog}
        title={t('INITIATE_ESIGNATURE_REQUEST')}>
        <FormattedMarkdown>{t('INITIATE_ESIGNATURE_REQUEST_DETAILS')}</FormattedMarkdown>
      </MsgBox>
    );
  };

  renderCannotESignLeaseDialog = () => (
    <MsgBox
      id="cannotESignLeaseDialog"
      open={this.state.isCannotESignLeaseDialogOpen}
      ref="cannotESignLeaseDialog"
      closeOnTapAway={false}
      lblOK={t('OK_GOT_IT')}
      lblCancel={''}
      onOKClick={() => this.setState({ isCannotESignLeaseDialogOpen: false })}
      onCloseRequest={() => this.setState({ isCannotESignLeaseDialogOpen: false })}
      title={t('CANNOT_ESIGN_LEASE')}>
      <div>
        <T.Text>{t('CANNOT_ESIGN_LEASE_DETAILS_DESCRIPTION')}</T.Text>
        <T.Text style={{ marginTop: '1em' }}>{t('CANNOT_ESIGN_LEASE_DETAILS_STEP1')}</T.Text>
        <T.Text style={{ marginTop: '1em' }}>{t('CANNOT_ESIGN_LEASE_DETAILS_STEP2')}</T.Text>
      </div>
    </MsgBox>
  );

  renderSyncInProgressDialog = () => (
    <MsgBox
      id="initiateESignatureRequestInProgressDialog"
      open={this.props.leaseSyncInProgress}
      title={t('ONE_MOMENT')}
      ref="initiateESignatureRequestInProgressDialog"
      lblOK={''}
      lblCancel={''}
      closeOnTapAway={false}>
      <div>
        <PreloaderBlock message={t('GETTING_DATA_FROM_EXTERNAL_SYSTEM')} />
      </div>
    </MsgBox>
  );

  renderVoidedLease = () => {
    const { lease, quote } = this.props;

    const term = quote.leaseTerms.find(lt => lt.id === lease.leaseTermId);
    const amount = this.getUnitRent(lease, term);
    const termLength = this.getLeaseTermLength(lease, term);

    const { baselineData: { timezone, publishedLease } = {} } = lease || {};
    let leaseEndDate;
    let leaseStartDate;

    if (publishedLease) {
      leaseEndDate = toMoment(publishedLease.leaseEndDate, { timezone }).format(MONTH_DATE_YEAR_FORMAT);
      leaseStartDate = toMoment(publishedLease.leaseStartDate, { timezone }).format(MONTH_DATE_YEAR_FORMAT);
    }

    return (
      <div className={cf('lease-voided')}>
        <div className={cf('lease-description')}>
          <Text inline>{` ${t('A')} `}</Text>
          <Text data-id="leasePeriodTermsTxt" inline bold>
            {' '}
            {` ${termLength} ${term.period} `}{' '}
          </Text>
          <Text data-id="leaseQuoteForUnitTxt" inline>
            {t('LEASE_FOR_UNIT')}
          </Text>
          <Text data-id="leaseUnitNameTxt" inline bold>{` ${getShortFormatRentableItem(quote.inventory)} `}</Text>
          <Text inline>{` ${t('AT')} `}</Text>
          <Money amount={amount} currency="USD" />
          <Text inline>{'/mo'}</Text>
          <Text data-id="leaseWasVoidedTxt" inline>{` ${t('WAS_VOIDED')} `}</Text>
          <Text data-id="leaseVoidedDateTxt" inline bold>{` ${formatDateAgo(lease.updated_at, timezone)}.`}</Text>
          <Text inline>
            {publishedLease
              ? ` ${t('PARTY_LEASE_SECTION_DESCRIPTION_WHEN_VOIDED_SECOND_PART', { leaseStartDate, leaseEndDate })} `
              : ` ${t('THE_LEASE_WAS_NEVER_PUBLISHED')}`}
          </Text>
        </div>
      </div>
    );
  };

  handleCounterSignWarningClose = () => () => {
    this.setState({
      isCounterSignWarningOpen: false,
    });
  };

  handleCounterSignContinue = () => () => {
    const { signUrl } = this.state;
    this.setState({
      isCounterSignWarningOpen: false,
    });
    this.redirectToSignUrl(signUrl);
  };

  renderCounterSignWarningDialog = () => {
    const { isCounterSignWarningOpen, hasApplicationStatusChanged } = this.state;
    return (
      isCounterSignWarningOpen && (
        <CounterSignerWarning
          hasApplicationStatusChanged={hasApplicationStatusChanged}
          onWarningClosed={this.handleCounterSignWarningClose()}
          isCounterSignWarningOpen={isCounterSignWarningOpen}
          onContinueClicked={this.handleCounterSignContinue()}
        />
      )
    );
  };

  renderInventoryHoldingWarningDialog = () => {
    const { isInventoryHoldingWarningOpen } = this.state;
    const holdingWarningModel = {
      title: t('INVENTORY_UNAVAILABLE_TITLE'),
      text: t('INVENTORY_RESERVED_MSG'),
      lblAction: t('MSG_BOX_BTN_OK'),
      lblCancel: '',
      handleCloseRequest: () => this.setState({ isInventoryHoldingWarningOpen: false }),
    };

    return isInventoryHoldingWarningOpen && <InventoryHoldingWarningDialog isOpen={isInventoryHoldingWarningOpen} model={holdingWarningModel} />;
  };

  handleLeaseDateWarningClose = () => () => {
    this.setState({
      isLeaseDateWarningDialogOpen: false,
    });
  };

  renderLeaseDateWarningDialog = () => {
    const { isLeaseDateWarningDialogOpen, leaseDateWarningDialogTitle, leaseDateWarningDialogContent } = this.state;

    return (
      isLeaseDateWarningDialogOpen && (
        <LeaseDateWarningDialog
          onDialogClosed={this.handleLeaseDateWarningClose()}
          isLeaseDateWarningDialogOpen={isLeaseDateWarningDialogOpen}
          onEditLeaseClicked={this.handleEditLease}
          titleText={leaseDateWarningDialogTitle}
          contentText={leaseDateWarningDialogContent}
        />
      )
    );
  };

  renderWetCounterSignDialog = () => {
    const { isWetCounterSignDialogOpen } = this.state;

    return (
      isWetCounterSignDialogOpen && (
        <MsgBox
          id="wetCountersignDialog"
          open={isWetCounterSignDialogOpen}
          ref="wetCountersignDialog"
          closeOnTapAway={false}
          lblOK={t('MARK_AS_WET_SIGNED_BUTTON')}
          onOKClick={this.handleMarkAsWetSigned}
          lblCancel={t('CANCEL')}
          title={t('EXECUTE_WET_COUNTERSIGN_TITLE')}
          onCloseRequest={() => this.setState({ isWetCounterSignDialogOpen: false, markAsWetSignedSignature: null, markAsWetSignedLeaseId: null })}>
          <FormattedMarkdown>{t('EXECUTE_WET_COUNTERSIGN_DESCRIPTION')}</FormattedMarkdown>
        </MsgBox>
      )
    );
  };

  handleOpenCounterSignDialogUpdated = () => this.setState({ isCounterSignUpdatedDialogOpen: true });

  renderCounterSignUpdatedDialog = () => {
    const { isCounterSignUpdatedDialogOpen } = this.state;

    return (
      isCounterSignUpdatedDialogOpen && (
        <MsgBox
          id="countersignUpdatedDialog"
          open={isCounterSignUpdatedDialogOpen}
          ref="countersignUpdatedDialog"
          closeOnTapAway={false}
          lblOK={t('OK_GOT_IT')}
          onOKClick={() => this.setState({ isCounterSignUpdatedDialogOpen: false })}
          lblCancel=""
          title={t('EXECUTED_COUNTERSIGN_UPDATED_TITLE')}
          onCloseRequest={() => this.setState({ isCounterSignUpdatedDialogOpen: false })}>
          <FormattedMarkdown>{t('EXECUTED_COUNTERSIGN_UPDATED_DESCRIPTION')}</FormattedMarkdown>
        </MsgBox>
      )
    );
  };

  render = () => {
    const {
      lease,
      unit,
      inventoryAvailability: { isInventoryUnavailable, inventoryAvailableDate },
      hasLeaseStarted,
      isRenewal,
    } = this.props;

    if (!lease) {
      return <div />;
    }

    if (lease.status === DALTypes.LeaseStatus.DRAFT) {
      return this.renderDraftState();
    }

    if (lease.status === DALTypes.LeaseStatus.VOIDED) {
      return this.renderVoidedLeaseState();
    }
    const isLeaseSubmitted = lease.status === DALTypes.LeaseStatus.SUBMITTED;
    const wasLeaseSent = (lease.signatures || []).filter(s => s.partyMemberId).some(s => s.status !== DALTypes.LeaseSignatureStatus.NOT_SENT);
    const signaturesInProgress = isLeaseSubmitted && wasLeaseSent;
    const isLeaseExecuted = lease.status === DALTypes.LeaseStatus.EXECUTED;
    const menuId = 'leaseForUnit_menu';

    if (isLeaseSubmitted && !wasLeaseSent) {
      return this.renderSubmittedState(wasLeaseSent);
    }

    return (
      <div>
        <Section
          padContent={false}
          title={
            <div>
              <SectionTitle className={cf('no-margin-bottom')} actionItems={this.renderMenu(lease.status, hasLeaseStarted, menuId)}>
                {isLeaseExecuted ? (
                  <T.Text bold inline>
                    {isRenewal ? t('RENEWAL_LEASE_EXECUTED', { unit }) : t('LEASE_EXECUTED', { unit })}
                  </T.Text>
                ) : (
                  <T.Text bold inline>
                    {this.getLeaseSectionUnitText(unit)}
                  </T.Text>
                )}
              </SectionTitle>
              {isInventoryUnavailable && (
                <LeaseStartWarning content={t('UNIT_NOT_AVAILABLE_TO_LEASE_WARNING', { name: this.getTitleInfo(), date: inventoryAvailableDate })} />
              )}
              {this.renderMissingAdditionalItemInfo()}
              {!isLeaseExecuted && this.shouldShowLeaseWarning() && this.renderMembersModifiedNotification()}
            </div>
          }
          actionItems={this.renderMenu(lease.status, hasLeaseStarted, menuId)}>
          <div style={{ padding: '0 1.5rem' }}>
            {signaturesInProgress && (
              <T.SubHeader data-id="leaseStateTxt" disabled>
                {t('SIGNATURES_IN_PROGRESS')}
              </T.SubHeader>
            )}
            {this.renderDescription(lease)}
          </div>
          {this.renderTable()}
        </Section>
        {this.renderVoidLeaseDialog(wasLeaseSent)}
        {this.renderMarkAsWetSignedDialog()}
        {this.renderMarkAsWetSignedForGuarantorsDialog()}
        {this.renderEditLeaseDialog()}
        {this.renderCounterSignWarningDialog()}
        {this.renderLeaseDateWarningDialog()}
        {this.renderInventoryHoldingWarningDialog()}
        {this.renderInitiateESignatureRequestDialog()}
        {this.renderWetCounterSignDialog()}
        {this.renderCounterSignUpdatedDialog()}
        {this.renderCannotESignLeaseDialog()}
        {this.renderSyncInProgressDialog()}
      </div>
    );
  };
}
