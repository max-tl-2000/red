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
import { t } from 'i18next';
import { Typography, PreloaderBlock, Section, CardMenu, CardMenuItem, RedList, RedTable } from 'components';

import { fetchQuote } from 'redux/modules/quotes';
import { getInventoryDetails } from 'redux/modules/inventoryStore';
import { getLayoutSummary } from 'helpers/inventory';
import DemoteDialog from './DemoteDialog';

import { DALTypes } from '../../../../common/enums/DALTypes';
import { cf } from './ApplicationProgress.scss';
import { formatDateAgo } from '../../../../common/helpers/date-utils';
import { formatMoment } from '../../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_FORMAT } from '../../../../common/date-constants';

const { SubHeader, Text } = Typography;
const { Divider } = RedList;
const { Money } = RedTable;

const headerByPromotionStatus = {
  [DALTypes.PromotionStatus.PENDING_APPROVAL]: 'APPLICATION_PENDING_APPROVAL',
  [DALTypes.PromotionStatus.APPROVED]: 'APPLICATION_APPROVED',
  [DALTypes.PromotionStatus.REQUIRES_WORK]: 'ADDITIONAL_WORK_REQUIRED',
};

@connect(
  (state, props) => ({
    lease: props.leases.find(lease => lease.status !== DALTypes.LeaseStatus.VOIDED),
  }),
  dispatch =>
    bindActionCreators(
      {
        getInventoryDetails,
        fetchQuote,
      },
      dispatch,
    ),
)
export default class ApplicationProgressForPartyPage extends Component {
  static propTypes = {
    inventory: PropTypes.object,
    quotes: PropTypes.array,
    lease: PropTypes.object,
    hasApplicationRequireWorkStatus: PropTypes.bool,
    quotePromotion: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      isDemoteApplicationDialogOpen: false,
    };
  }

  componentWillReceiveProps = nextProps => {
    const { hasApplicationRequireWorkStatus } = nextProps;

    const { showQuotes } = this.state;

    if (!showQuotes && hasApplicationRequireWorkStatus) {
      this.setState({ showQuotes: true });
    }
  };

  getQuoteAndInventory = async ({ quotePromotion }) => {
    const { quoteId } = quotePromotion || {};
    if (!quoteId) return;

    const { quotes = [] } = this.props;

    const quote = quotes.find(q => q.id === quoteId) || (await this.props.fetchQuote(quoteId, true));
    const inventory = quote?.inventory || (await this.props.getInventoryDetails(quote.inventoryId))?.data;

    if (quote && inventory) {
      this.setState({
        inventory,
        quote,
      });
    }
  };

  componentWillMount() {
    this.getQuoteAndInventory(this.props);
  }

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

  handleOnReviewApplicationClicked = () => {
    const { onReviewApplicationClicked } = this.props;
    onReviewApplicationClicked && onReviewApplicationClicked();
  };

  getDialogTitle = () => {
    const { hasALease } = this.props;
    return t(hasALease ? 'REVOKE_APPROVED_APPLICATION' : 'ABANDON_APPROVAL_REQUEST');
  };

  toggleQuotes = () => {
    const { showQuotes } = this.state;
    this.setState({ showQuotes: !showQuotes });
  };

  getHumanDate = timezone => {
    const {
      quotePromotion: { promotionStatus, updated_at },
    } = this.props;
    let daysAgo = formatDateAgo(updated_at, timezone);
    if (!daysAgo.includes(t('ON'))) {
      daysAgo = daysAgo.toLowerCase();
    }
    switch (promotionStatus) {
      case DALTypes.PromotionStatus.REQUIRES_WORK:
      case DALTypes.PromotionStatus.PENDING_APPROVAL:
        return `${t('APPROVAL_REQUEST')} ${daysAgo}`;
      case DALTypes.PromotionStatus.APPROVED:
        return `${t('APPROVED')} ${daysAgo}`;
      default:
        return '';
    }
  };

  renderMenu = () => {
    const { lease, canReviewApplication } = this.props;
    const { showQuotes } = this.state;
    const isLeaseExecuted = !!lease && lease.status === DALTypes.LeaseStatus.EXECUTED;

    return (
      <CardMenu id="pendingApprovalMenu" iconName="dots-vertical">
        <CardMenuItem data-id="hideOrViewAllQuotes" text={t(showQuotes ? 'HIDE_ALL_QUOTES' : 'VIEW_ALL_QUOTES')} onClick={this.toggleQuotes} />
        {canReviewApplication && <CardMenuItem onClick={this.handleOnReviewApplicationClicked} text={t('REVIEW_APPLICATION')} id="reviewApplication" />}
        <Divider />
        <CardMenuItem onClick={this.handleOpenDemoteApplicationDialog} text={this.getDialogTitle()} disabled={isLeaseExecuted} id="abandonRequestApproval" />
      </CardMenu>
    );
  };

  render() {
    const { quotePromotion, children, hasALease, renderQuotes, hasApplicationRequireWorkStatus } = this.props;
    const { quote } = this.state;
    const { showQuotes, inventory, isDemoteApplicationDialogOpen } = this.state;

    if (!inventory || !quote || !quotePromotion) {
      return <PreloaderBlock />;
    }

    // leaseStartDate is format like: 2017-05-16T00:00:00.000Z
    const { leaseStartDate, leaseTerms = [] } = quote || {};
    const { additionalAndOneTimeCharges = {} } = quote?.publishedQuoteData || quote || {};
    const leaseTerm = leaseTerms.find(x => x.id === (quotePromotion || {}).leaseTermId);
    const { adjustedMarketRent = 0, period, termLength } = leaseTerm || {};
    const layoutInf = inventory && getLayoutSummary(inventory);
    const { additionalCharges = [] } = additionalAndOneTimeCharges;

    const getMoveDate = () => (
      <Text data-id="moveDate">
        {' '}
        {t('APPLICATION_PROGRESS_MOVING_IN', {
          termLength,
          period,
          date: formatMoment(leaseStartDate, { format: MONTH_DATE_YEAR_FORMAT, timezone: quote.propertyTimezone }),
        })}{' '}
      </Text>
    );

    const getIncludes = () => (
      <div className={cf('includes')}>
        <Text>{t('INCLUDES')}:</Text>
        <ul className="ul-list">
          <li>
            <Text id="applicationLayoutInfoTxt" inline>
              {layoutInf}
            </Text>
          </li>
          {additionalCharges
            .filter(x => !x.parentFeeDisplayName)
            .map(additional => (
              <li key={`${additional.id}`}>
                <Text inline>{additional.displayName}</Text>
              </li>
            ))}
        </ul>
      </div>
    );

    return (
      <Section
        data-id="applicationPendingApproval"
        padContent={false}
        title={t(headerByPromotionStatus[quotePromotion.promotionStatus])}
        className={cf('application-progress')}
        actionItems={this.renderMenu()}>
        <div style={{ padding: '.5rem 1.5rem' }}>
          <Text data-id="applicationApprovalDateTxt" secondary style={{ paddingBottom: '.5rem' }}>
            {this.getHumanDate(quote.propertyTimezone)}
          </Text>
          <Money data-id="pendingApprovalAmount" amount={adjustedMarketRent} TextComponent={SubHeader} />
          <SubHeader inline secondary>
            /m
          </SubHeader>
          {getMoveDate()}
          {getIncludes()}
          {children}
          {
            <DemoteDialog
              quotePromotion={quotePromotion}
              isDemoteApplicationDialogOpen={isDemoteApplicationDialogOpen}
              onDialogClosed={this.handleCloseDemoteApplicationDialog}
              hasALease={hasALease}
              dialogTitle={this.getDialogTitle()}
            />
          }
        </div>
        {showQuotes && renderQuotes && renderQuotes(hasApplicationRequireWorkStatus)}
      </Section>
    );
  }
}
