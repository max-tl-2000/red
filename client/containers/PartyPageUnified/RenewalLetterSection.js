/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { importMovingOut, importCancelMoveout } from 'redux/modules/partyStore';
import { connect } from 'react-redux';
import { Section, Button, Typography, CardMenu, CardMenuItem, RedTable, Tag, FormattedMarkdown } from 'components';
import { getActiveLeaseWorkflowData } from 'redux/selectors/partySelectors';
import { getApplicantsWithDisclosures } from '../../redux/selectors/applicationSelectors';
import { promoteQuote } from '../../redux/modules/quotes';
import { getLeases } from '../../redux/selectors/partySelectors';
import { toMoment, now, formatMoment } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_FORMAT, DATE_US_FORMAT } from '../../../common/date-constants';
import { getPersonIdsWithQuoteComms, getQuoteCommunicationCreationDateForParty, isQuoteExpired, getDaysSinceQuoteWasPublished } from '../../helpers/quotes';
import { cf } from './RenewalLetterSection.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import LeaseTermSelectorDialog from '../Quotes/Promotion/LeaseTermSelectorDialog';
import { InventoryHoldingWarningDialog } from '../Quotes/InventoryHoldingWarningDialog';
import { leasingNavigator } from '../../helpers/leasing-navigator';
import { getShortFormatRentableItem } from '../../../common/helpers/quotes';
import MarkAsMovingOutImportDialog from './MarkAsMovingOutImportDialog';
import CancelMoveoutImportDialog from './CancelMoveoutImportDialog';
import { vacateReasonTranslationMapping } from '../../../common/enums/vacateReasons';
import { getActiveLeaseEndDate, getFormattedLeaseEndDate } from '../../../common/helpers/activeLease-utils';

const { Money } = RedTable;
const { Text } = Typography;

const getLatestLease = (leases, quotes) => {
  if (!leases.length || !quotes.length) return [];

  const leasesByUnit = leases.reduce((acc, lease) => {
    const quote = quotes.find(q => q.id === lease.quoteId);
    if (!quote || !quote.inventory) return acc;
    const previousValues = acc[quote.inventory.id];
    acc[quote.inventory.id] = [...(previousValues || []), lease];
    return acc;
  }, {});

  const result = Object.keys(leasesByUnit).map(inventoryId => {
    const unitLeases = leasesByUnit[inventoryId];
    const activeLease = unitLeases.find(lease => lease.status !== DALTypes.LeaseStatus.VOIDED);

    if (activeLease) return activeLease;

    const sortedVoidedLeases = unitLeases
      .filter(l => l.status === DALTypes.LeaseStatus.VOIDED)
      .sort((a, b) => toMoment(b.updated_at).diff(toMoment(a.updated_at)));

    return sortedVoidedLeases[0];
  });
  const [lease] = result.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)));
  return lease;
};

@connect(
  (state, props) => ({
    user: state.auth.user,
    quotes: state.quotes.quotes,
    communications: state.dataStore.get('communications'),
    leases: getLeases(state, props),
    applicantsWithDisclosures: getApplicantsWithDisclosures(state, props),
    activeLeaseWorkflowData: getActiveLeaseWorkflowData(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        promoteQuote,
        importMovingOut,
        importCancelMoveout,
      },
      dispatch,
    ),
)
export default class RenewalLetterSection extends Component {
  static propTypes = {
    activeLeaseWorkflowData: PropTypes.object,
    handleSendRenewalLetter: PropTypes.func,
    onOpenNewLeaseRequest: PropTypes.func,
    inventory: PropTypes.object,
    partyId: PropTypes.string,
    timezone: PropTypes.string,
    promoteQuote: PropTypes.func,
    handleShowDialog: PropTypes.func,
  };

  constructor() {
    super();

    this.state = {
      wasQuoteSentToAtLeastOneMember: false,
      hasPublishedQuote: false,
      isLeaseTermDialogOpen: false,
      isInventoryHoldingWarningDialogOpen: false,
      inventoryHoldingWarningDialogModel: {},
      isLeaseCreationInProgress: false,
    };
  }

  componentWillReceiveProps(nextProps) {
    this.updateState(nextProps);
  }

  componentWillMount() {
    this.updateState(this.props);
  }

  updateState = props => {
    const { partyId, quotes } = props;
    const partyComms = props.communications?.filter(comm => comm.parties.includes(partyId));

    const personsWithQuoteComm = getPersonIdsWithQuoteComms(partyComms);
    const quote = this.getLastQuote(quotes);
    const hasPublishedQuote = !!quote?.publishDate;

    personsWithQuoteComm.length && this.setState({ wasQuoteSentToAtLeastOneMember: true });
    hasPublishedQuote ? this.setState({ hasPublishedQuote: true }) : this.setState({ hasPublishedQuote: false });
  };

  getLastQuote = quotes => !!quotes.length && quotes[0];

  getLastSentQuoteCommDate = () => {
    const { communications, partyId } = this.props;
    const quoteComms = getQuoteCommunicationCreationDateForParty(communications, partyId);

    return quoteComms.sort((a, b) => toMoment(b).diff(toMoment(a)))[0];
  };

  getDaysDifferenceMessage = (date, timezone) => {
    const today = now({ timezone }).startOf('day');

    const daysToDisplay = today.diff(toMoment(date, { timezone }).startOf('day'), 'days');
    if (daysToDisplay === 0) {
      return t('TODAY');
    }
    if (daysToDisplay === 1) {
      return t('YESTERDAY');
    }
    return t('DATETIME_DAYS_AGO', { days: daysToDisplay });
  };

  getUnitRent = (lease, term) => {
    const { publishedLease } = lease.baselineData;
    return publishedLease ? publishedLease.unitRent : term.adjustedMarketRent;
  };

  renderVoidedLeaseMessage = (lease, quote) => {
    const term = quote.leaseTerms.find(lt => lt.id === lease.leaseTermId);
    const amount = this.getUnitRent(lease, term);

    const { baselineData: { timezone } = {} } = lease || {};
    const unitName = quote?.inventory?.name;
    return (
      <div className={cf('renewal-description')}>
        <Text inline>{` ${t('A')} `}</Text>
        <Text inline bold>
          {' '}
          {` ${term.termLength} ${term.period} `}{' '}
        </Text>
        <Text inline>{t('RENEWAL_LEASE_FOR_UNIT')}</Text>
        <Text inline bold>
          {` ${unitName}`}
        </Text>
        <Text inline>{` ${t('AT')} `}</Text>
        <Money amount={amount} currency="USD" />
        <Text inline>{'/mo'}</Text>
        <Text inline>{` ${t('WAS_VOIDED')} `}</Text>
        <Text inline bold>{` ${this.getDaysDifferenceMessage(lease.updated_at, timezone)}.`}</Text>
      </div>
    );
  };

  renderRenewalLetterExpiredMessage = (publishDate, timezone) => (
    <div className={cf('renewal-description')}>
      <Text inline secondary>
        {t('THE_RENEWAL_LETTER_PUBLISHED')}{' '}
      </Text>
      <Text inline bold>
        {t('DATETIME_DAYS_AGO', { days: getDaysSinceQuoteWasPublished(publishDate, timezone) })}{' '}
      </Text>
      <Text inline secondary>
        {t('HAS_EXPIRED')}
      </Text>
    </div>
  );

  renderRenewalLetterNotSentMessage = () => (
    <div className={cf('renewal-description')}>
      <Text inline secondary>{` ${t('A')} `}</Text>
      <Text inline secondary>
        {t('RENEWAL_LETTER_WAS_PUBLISHED')}
      </Text>
      <Text inline bold>
        {'not sent'}
      </Text>
    </div>
  );

  renderRenewalLetterSentMessage = timezone => {
    const lastSentQuoteCommDate = this.getLastSentQuoteCommDate();
    return (
      <div className={cf('renewal-description')}>
        <Text inline secondary>
          {t('RENEWAL_LETTER_SENT')}{' '}
        </Text>
        <Text inline bold>
          {this.getDaysDifferenceMessage(lastSentQuoteCommDate, timezone)}
        </Text>
      </div>
    );
  };

  renderUnavailablePricesMessage = () => (
    <div className={cf('renewal-description')}>
      <Text inline secondary>
        {t('RENEWAL_LETTER_NOT_PUBLISHED')}{' '}
      </Text>
      <Tag text={t('PRICE_UNAVAILABLE')} className={cf('tag')} />
    </div>
  );

  getInfoMessage = shouldDisplayNoPriceMessage => {
    const { leases, quotes, timezone } = this.props;
    const { hasPublishedQuote, wasQuoteSentToAtLeastOneMember } = this.state;

    if (shouldDisplayNoPriceMessage) {
      return this.renderUnavailablePricesMessage();
    }

    const quote = this.getLastQuote(quotes);
    const lease = getLatestLease(leases.toArray(), [quote]);

    if (lease && lease.status === DALTypes.LeaseStatus.VOIDED) {
      return this.renderVoidedLeaseMessage(lease, quote);
    }

    if (hasPublishedQuote) {
      const { expirationDate = '', publishDate } = quote;

      if (isQuoteExpired({ expirationDate, timezone })) {
        return this.renderRenewalLetterExpiredMessage(publishDate, timezone);
      }
      return !wasQuoteSentToAtLeastOneMember ? this.renderRenewalLetterNotSentMessage() : this.renderRenewalLetterSentMessage(timezone);
    }
    return '';
  };

  handleOpenRenewalLetterDialog = () => {
    const { handleShowDialog } = this.props;
    handleShowDialog && handleShowDialog(true);
  };

  renderMenu = () => {
    const { hasPublishedQuote } = this.state;
    if (!hasPublishedQuote) return <noscript />;

    return (
      <CardMenu iconName="dots-vertical">
        <CardMenuItem text={t('VIEW_RENEWAL_LETTER')} onClick={this.handleOpenRenewalLetterRequest} />
        <CardMenuItem text={t('SEND_RENEWAL_QUOTE')} onClick={this.handleOpenRenewalLetterDialog} />
        <CardMenuItem text={t('CREATE_NEW_RENEWAL_LETTER')} onClick={this.onSendRenewalLetterClick} />
      </CardMenu>
    );
  };

  getLowestRentTerm = leaseTerms => leaseTerms.sort((a, b) => a.adjustedMarketRent - b.adjustedMarketRent)[0];

  onViewParty = partyId => {
    this.setState({ isInventoryHoldingWarningDialogOpen: false });
    leasingNavigator.navigateToParty(partyId);
  };

  onInventoryHoldingWarningDialogClosed = () => this.setState({ isInventoryHoldingWarningDialogOpen: false });

  handleImportMovingOut = partyId => this.props.importMovingOut(partyId);

  handleCancelMoveOutNotice = partyId => this.props.importCancelMoveout(partyId);

  handleOpenRenewalLetterRequest = () => {
    const { quotes, openRenewalLetterRequest } = this.props;
    const quote = this.getLastQuote(quotes);
    openRenewalLetterRequest && openRenewalLetterRequest({ quote, isRenewalQuote: true });
  };

  onSendRenewalLetterClick = () => {
    const { activeLeaseWorkflowData, partyId, handleSendRenewalLetter } = this.props;
    handleSendRenewalLetter && handleSendRenewalLetter({ inventory: activeLeaseWorkflowData.inventory, partyId, isRenewalQuote: true });
  };

  handleOnAction = (actionType, quoteId, selectedLeaseTermOnDialog = {}) => {
    const { partyId } = this.props;
    const { id: leaseTermId } = selectedLeaseTermOnDialog;

    const requestData = {
      partyId,
      quoteId,
      leaseTermId,
    };

    this.handleCloseLeaseTermSelectorDialog({ leaseCreationInProgress: true });
    this.handlePromoteQuote(requestData);
  };

  handlePromoteQuote = async requestData => {
    const { onOpenNewLeaseRequest } = this.props;

    const { lease } = await this.props.promoteQuote({ ...requestData }, DALTypes.PromotionStatus.APPROVED, false);
    if (!lease) {
      console.error('Invalid data for lease creation', requestData);
      return;
    }

    onOpenNewLeaseRequest && onOpenNewLeaseRequest(lease);
    this.setState({ isLeaseCreationInProgress: false });
  };

  shouldOpenLeaseTermDialog = quote => quote?.publishedQuoteData?.leaseTerms?.length > 1;

  handleCloseLeaseTermSelectorDialog = ({ leaseCreationInProgress = false }) => {
    if (!leaseCreationInProgress) this.setState({ isLeaseCreationInProgress: false });
    this.setState({ isLeaseTermDialogOpen: false });
  };

  onCreateLeaseClick = () => {
    this.setState({ isLeaseCreationInProgress: true });

    const { quotes, partyId } = this.props;
    const quote = this.getLastQuote(quotes);

    if (this.shouldOpenLeaseTermDialog(quote)) {
      this.setState({ isLeaseTermDialogOpen: true });
      return;
    }

    const {
      id,
      publishedQuoteData: { leaseTerms },
    } = quote;
    const requestData = {
      partyId,
      quoteId: id,
      leaseTermId: leaseTerms[0].id,
    };
    this.handlePromoteQuote(requestData);
  };

  renderRenewalContent = () => {
    const { timezone, activeLeaseWorkflowData = {}, quotes, user, applicantsWithDisclosures, inventory, partyId } = this.props;
    const { isLeaseTermDialogOpen, hasPublishedQuote, isLeaseCreationInProgress } = this.state;
    const leaseEndDate = getActiveLeaseEndDate(activeLeaseWorkflowData);

    const formattedEndDate = leaseEndDate && toMoment(leaseEndDate, { timezone }).startOf('day');
    const noOfDaysBeforeLeaseEnds = formattedEndDate && formattedEndDate.diff(now({ timezone }).startOf('day'), 'days');

    const quote = this.getLastQuote(quotes);
    const atLeastTwoLeaseTermsAvailable = this.shouldOpenLeaseTermDialog(quote);
    const leaseTerms = quote?.publishedQuoteData?.leaseTerms;
    const defaultSelectedLeaseTerm = atLeastTwoLeaseTermsAvailable && this.getLowestRentTerm(leaseTerms);
    const shouldDisplayNoPriceMessage = !hasPublishedQuote && inventory && !inventory?.renewalMarketRent;

    const formattedLeaseEndDate =
      formattedEndDate?.format && getFormattedLeaseEndDate(formattedEndDate.format(MONTH_DATE_YEAR_FORMAT), noOfDaysBeforeLeaseEnds);
    const leaseEndDateMsg = noOfDaysBeforeLeaseEnds < 0 ? t('CURRENT_LEASE_ENDED_ON') : t('CURRENT_LEASE_ENDS_ON');
    return (
      <div>
        {formattedEndDate && (
          <div className={cf('renewal-description')}>
            <Text secondary>{`${leaseEndDateMsg} ${formattedLeaseEndDate}`}</Text>
            {this.getInfoMessage(shouldDisplayNoPriceMessage)}
          </div>
        )}
        <div className={cf('renewal-buttons')}>
          <Button
            data-id="sendRenewalLetterBtn"
            className={cf('btn-shadow')}
            loading={hasPublishedQuote && isLeaseCreationInProgress}
            disabled={hasPublishedQuote && isLeaseCreationInProgress}
            btnRole={shouldDisplayNoPriceMessage ? 'secondary' : 'primary'}
            label={hasPublishedQuote ? t('CREATE_LEASE') : t('REVIEW_RENEWAL_LETTER')}
            onClick={hasPublishedQuote ? this.onCreateLeaseClick : this.onSendRenewalLetterClick}
          />
          <Button
            data-id="markAsMovingOutBtn"
            className={cf('btn-shadow', 'secondary-button')}
            btnRole="secondary"
            label={t('MARK_AS_MOVING_OUT')}
            onClick={() => this.handleImportMovingOut(partyId)}
          />
        </div>
        {isLeaseTermDialogOpen && hasPublishedQuote && (
          <LeaseTermSelectorDialog
            quote={quote}
            user={user}
            open={isLeaseTermDialogOpen}
            onCloseRequest={this.handleCloseLeaseTermSelectorDialog}
            onAction={this.handleOnAction}
            selectedTerm={defaultSelectedLeaseTerm}
            applicantsWithDisclosures={applicantsWithDisclosures}
            atLeastTwoLeaseTermsAvailable={atLeastTwoLeaseTermsAvailable}
            isRenewal
          />
        )}
        <MarkAsMovingOutImportDialog />
      </div>
    );
  };

  renderIsEviction = () => {
    const { activeLeaseWorkflowData, party: { timezone } = {} } = this.props;
    const { vacateDate } = activeLeaseWorkflowData.metadata;

    const dateSettings = { format: DATE_US_FORMAT, timezone };
    const formattedVacateDate = vacateDate && formatMoment(vacateDate, { ...dateSettings, includeZone: false });

    return (
      <div className={cf('renewal-description')}>
        <FormattedMarkdown>
          {formattedVacateDate ? t('EVICTED_PARTY_WITH_VACATE_DATE', { vacateDate: formattedVacateDate }) : t('EVICTED_PARTY_WITHOUT_VACATE_DATE')}
        </FormattedMarkdown>
      </div>
    );
  };

  renderCancelMoveOut = () => {
    const { activeLeaseWorkflowData, partyId, party: { timezone } = {} } = this.props;
    const { isInventoryHoldingWarningDialogOpen, inventoryHoldingWarningDialogModel } = this.state;
    const { notes = '', vacateDate } = activeLeaseWorkflowData.metadata;

    const dateSettings = { format: DATE_US_FORMAT, timezone };
    const formattedVacateDate = vacateDate && formatMoment(vacateDate, { ...dateSettings, includeZone: false });
    const moveOutReason = notes && vacateReasonTranslationMapping[notes.trim()];

    return (
      <div>
        <div className={cf('renewal-description')}>
          <FormattedMarkdown>{t('MOVING_OUT_SERVED_BY_MRI', { vacateDate: formattedVacateDate, vacateReason: t(moveOutReason) })}</FormattedMarkdown>
        </div>
        <div className={cf('renewal-buttons')}>
          <Button
            data-id="cancelMovingOutBtn"
            className={cf('btn-shadow')}
            btnRole="secondary"
            label={t('CANCEL_MOVING_OUT')}
            onClick={() => this.handleCancelMoveOutNotice(partyId)}
          />
        </div>
        {isInventoryHoldingWarningDialogOpen && (
          <InventoryHoldingWarningDialog isOpen={isInventoryHoldingWarningDialogOpen} model={inventoryHoldingWarningDialogModel} />
        )}
        <CancelMoveoutImportDialog />
      </div>
    );
  };

  renderMoveOutContent = () => {
    const { activeLeaseWorkflowData } = this.props;
    const { isUnderEviction = false } = activeLeaseWorkflowData.metadata;

    return isUnderEviction ? this.renderIsEviction() : this.renderCancelMoveOut();
  };

  isMovingOut = () => this.props.activeLeaseWorkflowData?.state === DALTypes.ActiveLeaseState.MOVING_OUT;

  isEviction = () => !!this.props.activeLeaseWorkflowData?.metadata?.isUnderEviction;

  getTitleKey = () => {
    const { leases, quotes, timezone } = this.props;
    const { wasQuoteSentToAtLeastOneMember } = this.state;
    const quote = this.getLastQuote(quotes);
    const { expirationDate } = quote;
    const lease = getLatestLease(leases.toArray(), [quote]);
    const isMovingOut = this.isMovingOut();
    const isEviction = this.isEviction();

    if (isEviction) {
      return 'RENEWAL_LETTER_EVICTION_TITLE';
    }

    if (isMovingOut) {
      return 'RENEWAL_LETTER_MOVE_OUT_TITLE';
    }

    if (lease && lease.status === DALTypes.LeaseStatus.VOIDED) {
      return 'RENEWAL_LETTER_VOIDED_TITLE';
    }

    if (isQuoteExpired({ expirationDate, timezone })) {
      return 'RENEWAL_LETTER_EXPIRED_TITLE';
    }

    if (wasQuoteSentToAtLeastOneMember) {
      return 'RENEWAL_LETTER_SENT_TITLE';
    }

    return 'RENEWAL_LETTER_TITLE';
  };

  render() {
    const { activeLeaseWorkflowData = {} } = this.props;
    const { inventory } = activeLeaseWorkflowData;
    const isMovingOut = this.isMovingOut();
    const titleTranslationKey = this.getTitleKey();
    const unit = getShortFormatRentableItem(inventory);

    return (
      <Section data-id="renewalLetterSection" padContent title={t(titleTranslationKey, { unit })} actionItems={this.renderMenu()}>
        {isMovingOut ? this.renderMoveOutContent() : this.renderRenewalContent()}
      </Section>
    );
  }
}
