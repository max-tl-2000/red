/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Avatar, Typography, AutoSize, IconButton, Icon } from 'components';
import get from 'lodash/get';
import generateId from 'helpers/generateId';
import { cf } from './PartySummary.scss';
import { getLeadScoreIcon } from '../../../helpers/leadScore';
import { getMostRecentCommunication } from '../../../helpers/communications';
import PartySummaryCard from './PartySummaryCard';
import { formattedNumBedroomsForFilters, getMoveInDateSummary } from '../../../helpers/unitsUtils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { formatMoment, toMoment, now } from '../../../../common/helpers/moment-utils';
import { DATE_US_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../../../common/date-constants';
import { getActiveLeaseEndDate, getFormattedLeaseEndDate } from '../../../../common/helpers/activeLease-utils';
import { getShortFormatRentableItem } from '../../../../common/helpers/quotes';

const { Text, Caption, Link } = Typography;

const isLeaseInState = (leases, state) => leases.length && leases[0].status === state;

const isLeaseExecuted = leases => isLeaseInState(leases, DALTypes.LeaseStatus.EXECUTED);

const isLeaseInDraftState = leases => isLeaseInState(leases, DALTypes.LeaseStatus.DRAFT);

const getNextPartyStep = ({ partyState, allApplicationsAreCompleted, leases, partyMembers }) => {
  switch (partyState) {
    case DALTypes.PartyStateType.CONTACT:
      return 'SCHEDULE_TOUR';
    case DALTypes.PartyStateType.LEAD:
      return 'COMPLETE_TOUR';
    case DALTypes.PartyStateType.PROSPECT:
      return 'COMPLETE_APPLICATION';
    case DALTypes.PartyStateType.APPLICANT:
      if (allApplicationsAreCompleted) {
        return isLeaseInDraftState(leases) ? 'PUBLISH_LEASE' : 'PROMOTE_APPLICATION';
      }

      return partyMembers.length > 1 ? 'COMPLETE_APPLICATION_plural' : 'COMPLETE_APPLICATION';
    case DALTypes.PartyStateType.LEASE:
      return isLeaseExecuted(leases) ? '' : 'COLLECT_SIGNATURES';
    default:
      return '';
  }
};

const getRenewalNextPartyStep = ({ quotes, leases, partyState }) => {
  const isQuotePublished = !!quotes.find(quote => quote.publishDate);

  switch (partyState) {
    case DALTypes.PartyStateType.PROSPECT:
      return isQuotePublished ? 'PUBLISH_LEASE' : 'SEND_RENEWAL_QUOTE';
    case DALTypes.PartyStateType.APPLICANT:
      return 'PUBLISH_LEASE';
    case DALTypes.PartyStateType.LEASE:
      return isLeaseExecuted(leases) ? '' : 'COLLECT_SIGNATURES';
    default:
      return '';
  }
};

const getPartySummaryCard = ({ className, style, displayIconOnly, iconName, value, cssClassIcon, avatarClassName, label }) => (
  <PartySummaryCard
    key={generateId(PartySummaryCard)}
    className={className || cf('body-card')}
    style={style}
    displayIconOnly={displayIconOnly}
    iconName={iconName}
    value={value}
    cssClassIcon={cssClassIcon}
    avatarClassName={avatarClassName}
    label={label}
  />
);

export class PartySummary extends Component {
  static propTypes = {
    ownerAgent: PropTypes.object,
    party: PropTypes.object,
    activeLeaseWorkflowData: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      displaySummary: true,
    };
  }

  toggleSummary = () => {
    this.setState({
      displaySummary: !this.state.displaySummary,
    });
  };

  getSummary = () => {
    const { props } = this;
    const { associatedProperty, party, filters, numberOfGuarantors, leases, numberOfPets, partyProgram, activeLeaseWorkflowData } = props;
    const { state: partyState } = party;

    let timezone = leases.length > 0 ? get(leases[0], 'baselineData.timezone') : undefined;
    if (!timezone) {
      timezone = party.timezone || props.timezone;
    }

    const { metadata } = party || {};
    const { creationType } = metadata || {};

    const firstContactChannel = get(party, 'metadata.firstContactChannel');
    const firstContactedDate = get(party, 'metadata.firstContactedDate');
    const humanizedDuration = firstContactedDate ? toMoment(firstContactedDate, { timezone }).fromNow() : '';
    const layout = get(party, 'qualificationQuestions.numBedrooms') || [];
    const numberOfBeds = formattedNumBedroomsForFilters(layout);
    const { moveInDate } = filters;
    const moveInDateSummary = moveInDate ? getMoveInDateSummary(moveInDate, { timezone }) : '';
    const leaseStartDate = leases.length ? get(leases[0], 'baselineData.publishedLease.leaseStartDate') : null;
    const leaseMoveInDate = leases.length ? get(leases[0], 'baselineData.publishedLease.moveInDate') : null;

    const dateSettings = { format: DATE_US_FORMAT, timezone };

    const moveInDateFormatted = leaseMoveInDate ? formatMoment(leaseMoveInDate, dateSettings) : undefined;
    const leaseStartDateFormatted = leaseStartDate ? formatMoment(leaseStartDate, dateSettings) : undefined;

    const list = [];
    const bussinesCardSource = metadata && metadata.teamMemberSource && t('BUSINESS_CARD');
    const transferAgentSource = metadata?.transferAgentSource?.displayName;

    const alternativeSource = bussinesCardSource || transferAgentSource;

    const theSource = creationType === 'user' ? t('ENTERED_BY_AGENT') : partyProgram || alternativeSource;

    const isNewLeaseInResidentState = partyState === DALTypes.PartyStateType.RESIDENT && !!leases.length;
    if (partyState !== DALTypes.PartyStateType.RESIDENT || isNewLeaseInResidentState) {
      list.push(getPartySummaryCard({ iconName: 'property', label: t('INTERESTED_PROPERTY'), value: associatedProperty }));
      list.push(getPartySummaryCard({ iconName: 'share-variant', label: t('SOURCE'), value: theSource }));
    }

    // TODO: refactor this to avoid code duplication

    if (partyState === DALTypes.PartyStateType.CONTACT) {
      list.push(getPartySummaryCard({ iconName: 'calendar', label: t('FIRST_CONTACT'), value: `${humanizedDuration}` }));
      list.push(getPartySummaryCard({ iconName: 'phone', label: t('INITIAL_CHANNEL'), value: firstContactChannel }));
    } else if (partyState === DALTypes.PartyStateType.LEAD) {
      list.push(getPartySummaryCard({ iconName: 'bed', label: t('LAYOUT'), value: numberOfBeds }));
      moveInDateSummary && list.push(getPartySummaryCard({ iconName: 'calendar', label: t('MOVE_IN_DATE'), value: moveInDateSummary }));
    } else if (partyState === DALTypes.PartyStateType.PROSPECT || partyState === DALTypes.PartyStateType.APPLICANT) {
      list.push(getPartySummaryCard({ iconName: 'am-culture-pet-friendly', label: t('PET_plural'), value: numberOfPets }));
      list.push(getPartySummaryCard({ iconName: 'account', label: t('GUARANTOR_plural'), value: numberOfGuarantors }));
      if (moveInDateSummary) {
        list.push(getPartySummaryCard({ iconName: 'calendar', label: t('MOVE_IN_DATE'), value: moveInDateSummary }));
      } else {
        moveInDateFormatted && list.push(getPartySummaryCard({ iconName: 'calendar', label: t('MOVE_IN_DATE'), value: moveInDateFormatted }));
      }
    } else if (partyState === DALTypes.PartyStateType.LEASE) {
      list.push(getPartySummaryCard({ iconName: 'am-culture-pet-friendly', label: t('PET_plural'), value: numberOfPets }));
      list.push(getPartySummaryCard({ iconName: 'account', label: t('GUARANTOR_plural'), value: numberOfGuarantors }));
      leaseStartDateFormatted && list.push(getPartySummaryCard({ iconName: 'calendar', label: t('LEASE_START_DATE'), value: leaseStartDateFormatted }));
    } else if (partyState === DALTypes.PartyStateType.FUTURERESIDENT || isNewLeaseInResidentState) {
      list.push(getPartySummaryCard({ iconName: 'am-culture-pet-friendly', label: t('PET_plural'), value: numberOfPets }));
      leaseStartDateFormatted && list.push(getPartySummaryCard({ iconName: 'calendar', label: t('LEASE_START_DATE'), value: leaseStartDateFormatted }));
      moveInDateFormatted && list.push(getPartySummaryCard({ iconName: 'calendar', label: t('MOVE_IN_DATE'), value: moveInDateFormatted }));
    } else if (partyState === DALTypes.PartyStateType.RESIDENT) {
      const leaseData = activeLeaseWorkflowData?.leaseData;
      const vacateDate = activeLeaseWorkflowData?.metadata?.vacateDate;
      const formattedVacateDate = vacateDate && formatMoment(vacateDate, { ...dateSettings, includeZone: false });
      const formattedStartDate = leaseData?.leaseStartDate && formatMoment(leaseData?.leaseStartDate, { ...dateSettings, includeZone: false });
      const leaseEndDate = getActiveLeaseEndDate(activeLeaseWorkflowData);
      const formattedEndDate = leaseEndDate && formatMoment(leaseEndDate, { ...dateSettings, includeZone: false });
      const leaseTerm = leaseData?.leaseTerm;

      list.push(getPartySummaryCard({ iconName: 'property', label: t('PROPERTY'), value: associatedProperty }));
      formattedStartDate &&
        formattedEndDate &&
        list.push(
          getPartySummaryCard({
            iconName: 'calendar',
            label: t('LEASE_START_AND_END'),
            value: `${formattedStartDate} - ${formattedEndDate}`,
          }),
        );

      vacateDate &&
        list.push(
          getPartySummaryCard({
            iconName: 'calendar',
            label: t('VACATE_DATE'),
            value: formattedVacateDate,
          }),
        );

      !vacateDate &&
        leaseTerm &&
        list.push(
          getPartySummaryCard({
            iconName: 'calendar-text',
            label: t('LEASE_TERM'),
            value: `${leaseTerm} ${leaseTerm === 1 ? t('MONTH') : t('MONTHS')}`,
          }),
        );
    }

    return list;
  };

  getLastSentQuoteCommDate = partyComms => {
    const quoteComms = partyComms.reduce((acc, comm) => {
      comm.category === DALTypes.CommunicationCategory.QUOTE && acc.push(comm);
      return acc;
    }, []);

    const lastQuoteComm = getMostRecentCommunication(quoteComms);
    return lastQuoteComm?.created_at;
  };

  getLastIncomingCommDate = partyComms => {
    const incomingComms = partyComms.reduce((acc, comm) => {
      comm.direction === DALTypes.CommunicationDirection.IN && acc.push(comm);
      return acc;
    }, []);

    const lastIncomingComm = getMostRecentCommunication(incomingComms);
    return lastIncomingComm?.created_at;
  };

  getDaysDifferenceSinceLastQuoteWasSent = (lastSentQuoteCommDate, timezone) => {
    const daysToDisplay = now({ timezone }).diff(toMoment(lastSentQuoteCommDate, { timezone }), 'days');
    if (daysToDisplay === 0) {
      return `${t('SENT')} ${t('TODAY')}`;
    }
    if (daysToDisplay === 1) {
      return `${t('SENT')} ${t('YESTERDAY')}`;
    }
    return `${t('SENT')} ${t('DATETIME_DAYS_AGO', { days: daysToDisplay })}`;
  };

  getLastQuote = quotes => !!quotes.length && quotes[0];

  getRenewalLetterCommunicationStatusMessage = () => {
    const { hasRenewalPartyActivePromotion, communications, party, timezone, inventory, quotes } = this.props;
    const quote = this.getLastQuote(quotes);
    const hasPublishedQuote = !!quote?.publishDate;
    const shouldDisplayNoPriceMessage = !hasPublishedQuote && inventory && !inventory?.renewalMarketRent;

    if (shouldDisplayNoPriceMessage) return t('PRICE_UNAVAILABLE');

    if (hasRenewalPartyActivePromotion) return t('PROMOTED_TO_LEASE');

    const partyComms = communications?.filter(comm => comm.parties.includes(party.id));
    const lastSentQuoteDate = this.getLastSentQuoteCommDate(partyComms);
    if (!lastSentQuoteDate) return t('NOT_SENT');

    const lastIncomingComm = this.getLastIncomingCommDate(partyComms);
    return lastIncomingComm && toMoment(lastIncomingComm, { timezone }).isAfter(toMoment(lastSentQuoteDate, { timezone }))
      ? t('RESPONDED')
      : this.getDaysDifferenceSinceLastQuoteWasSent(lastSentQuoteDate, timezone);
  };

  getRenewalSummary = () => {
    const { associatedProperty, activeLeaseWorkflowData, timezone } = this.props;
    const inventory = activeLeaseWorkflowData?.inventory;

    const dateSettings = { format: DATE_US_FORMAT, timezone };
    const vacateDate = activeLeaseWorkflowData?.metadata?.vacateDate;
    const formattedVacateDate = vacateDate && formatMoment(vacateDate, { ...dateSettings, includeZone: false });

    const leaseEndDate = getActiveLeaseEndDate(activeLeaseWorkflowData);
    const formattedEndDate = leaseEndDate && toMoment(leaseEndDate, { timezone }).startOf('day');
    const noOfDaysBeforeLeaseEnds = formattedEndDate?.diff(now({ timezone }).startOf('day'), 'days');

    const inventoryItemsText = inventory && getShortFormatRentableItem(inventory);
    const renewalLetterStatusText = this.getRenewalLetterCommunicationStatusMessage();

    const list = [];
    list.push(getPartySummaryCard({ iconName: 'property', label: t('PROPERTY'), value: associatedProperty }));
    if (formattedEndDate) {
      list.push(
        getPartySummaryCard({
          iconName: 'calendar',
          label: noOfDaysBeforeLeaseEnds < 0 ? t('CURRENT_LEASE_ENDED_ON') : t('CURRENT_LEASE_ENDS_ON'),
          value: getFormattedLeaseEndDate(formattedEndDate.format(MONTH_DATE_YEAR_FORMAT), noOfDaysBeforeLeaseEnds),
        }),
      );
    }
    list.push(getPartySummaryCard({ iconName: 'send', label: t('RENEWAL_LETTER_STATE'), value: renewalLetterStatusText }));
    if (inventoryItemsText) {
      list.push(getPartySummaryCard({ iconName: 'home', label: t('RENTED_INVENTORY'), value: inventoryItemsText }));
    }
    list.push(getPartySummaryCard({ iconName: 'file-document', label: t('LEASE_TYPE_LABEL'), value: t('RENEWAL') }));

    vacateDate && list.push(getPartySummaryCard({ iconName: 'calendar', label: t('VACATE_DATE'), value: formattedVacateDate }));

    return list;
  };

  getHeader = ({ isLargeGrid, isMediumGrid, isSmallGrid }) => {
    const { props, state } = this;
    const { ownerAgent, party, leases, partyIsRenewal } = props;
    const { displaySummary } = state;
    const partyType = get(party, 'qualificationQuestions.groupProfile');
    const leadScoreIcon = getLeadScoreIcon(party.score);
    const hasLease = leases.length > 0;
    const { state: partyState } = party;

    return (
      <div className={cf('headline')}>
        <div className={cf('left-column')}>
          {ownerAgent?.fullName && (
            <div data-id="ownerPartyName" className={cf('card', 'header-card')}>
              <Avatar userName={ownerAgent.fullName} className={cf('icon')} src={ownerAgent.avatarUrl} />
              <Text>{ownerAgent.fullName}</Text>
            </div>
          )}
          {partyType && !partyIsRenewal && (
            <PartySummaryCard
              dataId="partySummaryPartyType"
              className={cf('header-card')}
              displayIconOnly={isSmallGrid || isMediumGrid}
              value={t(partyType)}
              avatarClassName={partyType.toLowerCase()}
            />
          )}
          {!hasLease && !partyIsRenewal && partyState !== DALTypes.PartyStateType.RESIDENT && (
            <PartySummaryCard
              className={cf('header-card')}
              displayIconOnly={isSmallGrid || isMediumGrid}
              iconName={leadScoreIcon}
              value={t('LEAD_SCORE')}
              cssClassIcon={'icon-blue'}
            />
          )}
        </div>
        <div className={cf('right-column')}>
          {isLargeGrid && this.getNextStep()}
          {(isSmallGrid || isMediumGrid) && <IconButton iconName={displaySummary ? 'menu-up' : 'menu-down'} onClick={this.toggleSummary} />}
        </div>
      </div>
    );
  };

  getNextStep = () => {
    const { props } = this;
    const { party, leases, allApplicationsAreCompleted, partyMembers, partyIsRenewal, quotes, activeLeaseWorkflowData } = props;
    const isMovingOut = activeLeaseWorkflowData?.state === DALTypes.ActiveLeaseState.MOVING_OUT;
    const nextPartyStep = !partyIsRenewal
      ? getNextPartyStep({ partyState: party.state, allApplicationsAreCompleted, leases, partyMembers })
      : getRenewalNextPartyStep({ quotes, leases, partyState: party.state });
    if (!nextPartyStep || isMovingOut) return null;

    return (
      <div className={cf('next-step')}>
        <Caption inline bold className={cf('label')}>
          {t('NEXT_STEP')}
        </Caption>
        <Caption inline bold>
          {t(nextPartyStep)}
        </Caption>
      </div>
    );
  };

  getBannerText = () => {
    const { party, activeLeaseWorkflowData } = this.props;
    if (party?.metadata?.activatePaymentPlanDate && activeLeaseWorkflowData?.metadata?.legalStipulationInEffect) {
      return `${t('LEGAL_STIPULATION_IN_EFFECT')} | ${t('PAYMENT_PLAN_REQUESTED')}`;
    }
    if (party?.metadata?.activatePaymentPlanDate) {
      return t('PAYMENT_PLAN_REQUESTED');
    }

    return t('LEGAL_STIPULATION_IN_EFFECT');
  };

  render() {
    const { state, props } = this;
    const { displaySummary } = state;
    const { partyIsRenewal, partyMembers, onManagePartyLinkClicked } = props;

    const hasVacatedPartyMembers = partyMembers.some(member => member.vacateDate);

    return (
      <AutoSize breakpoints={{ 'small-grid': [0, 360], 'medium-grid': [361, 720], 'large-grid': [721, Infinity] }}>
        {({ breakpoint }) => {
          const isSmallGrid = breakpoint === 'small-grid';
          const isMediumGrid = breakpoint === 'medium-grid';
          const isLargeGrid = breakpoint === 'large-grid';
          const shouldShowIconOnly = isSmallGrid || isMediumGrid;
          return (
            <div>
              {(props.party.metadata?.activatePaymentPlanDate || props.activeLeaseWorkflowData?.metadata?.legalStipulationInEffect) && (
                <div className={cf('payment-plan-card')}>
                  <Text>{this.getBannerText()}</Text>
                </div>
              )}
              <div data-id="partySummarySection" className={cf('party-summary')}>
                {this.getHeader({ isSmallGrid, isMediumGrid, isLargeGrid })}
                {displaySummary && (
                  <div data-id="partySummaryBodySection" className={cf('body', { narrow: shouldShowIconOnly })}>
                    {!partyIsRenewal ? this.getSummary({ isLargeGrid }) : this.getRenewalSummary()}
                    {shouldShowIconOnly && this.getNextStep()}
                  </div>
                )}
                {partyIsRenewal && hasVacatedPartyMembers && (
                  <div className={cf('vacate-members-warning')}>
                    <Icon name="alert" className={cf('alert-icon')} />
                    <Text>
                      {t('VERIFY_PARTY_MEMBERSHIP_MSG')}
                      <Link className={cf('link')} onClick={() => onManagePartyLinkClicked && onManagePartyLinkClicked()} underline>
                        {t('MANAGE_PARTY_LINK_MSG')}
                      </Link>
                    </Text>
                  </div>
                )}
              </div>
            </div>
          );
        }}
      </AutoSize>
    );
  }
}
