/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { Section } from 'components';
import { t } from 'i18next';
import { getQuotePromotions, getPromotedQuotes } from 'redux/selectors/partySelectors';
import { isUserAllowedToReviewApplication, getApplicantsWithDisclosures, isPartyApplicationOnHold } from 'redux/selectors/applicationSelectors';
import { getScreeningExpirationResults } from 'redux/selectors/screeningSelectors';
import { action } from 'mobx';
import { DALTypes } from 'enums/DALTypes';
import QuoteList from '../Quotes/QuoteList';
import { cf } from './QuoteListWrapper.scss';
import { isApplicationApprovable } from '../../../common/helpers/quotes';
import { updateQuotePromotion } from '../../redux/modules/quotes';

@connect(
  (state, props) => {
    const quotes = state.quotes.quotes;
    const screeningExpiration = getScreeningExpirationResults(state, props);
    return {
      quotes,
      hasQuotes: quotes && quotes.length && quotes.some(quote => !quote.pristine),
      quotePromotions: getQuotePromotions(state, props),
      applicantsWithDisclosures: getApplicantsWithDisclosures(state, props),
      canReviewApplication: isUserAllowedToReviewApplication(state, props),
      partyApplicationOnHold: isPartyApplicationOnHold(state, props),
      screeningExpirationResults: screeningExpiration.results,
      promotedQuotes: getPromotedQuotes(state, props),
    };
  },
  dispatch =>
    bindActionCreators(
      {
        updateQuotePromotion,
      },
      dispatch,
    ),
)
export default class QuoteListWrapper extends Component {
  @action
  handleDecisionApplication = async (decisionModel, promotionStatus) => {
    const { props } = this;

    const { quotePromotions, partyId, onOpenLeaseFormRequest } = props;
    if (!quotePromotions.size) return;

    const quotePromotion = decisionModel.quoteId
      ? quotePromotions.find(p => p.quoteId === decisionModel.quoteId && isApplicationApprovable(p.promotionStatus))
      : quotePromotions.find(p => isApplicationApprovable(p.promotionStatus));

    if (!quotePromotion) return;

    const lease = await props.updateQuotePromotion(partyId, quotePromotion.id, promotionStatus, decisionModel);
    if (promotionStatus === DALTypes.PromotionStatus.APPROVED && lease) {
      onOpenLeaseFormRequest && onOpenLeaseFormRequest(lease);
    }
  };

  handleOnApproveApplication = approvalModel => this.handleDecisionApplication(approvalModel, DALTypes.PromotionStatus.APPROVED);

  get quoteListProps() {
    const { props } = this;
    const {
      onOpenQuoteRequest,
      onOpenManagePartyPageRequest,
      onOpenNewLeaseRequest,
      onOpenReviewApplicationRequest,
      partyId,
      quotePromotions,
      partyMembers,
      canReviewApplication,
      partyApplicationOnHold,
      applicantsWithDisclosures,
      screeningExpirationResults,
      promotedQuotes,
      displayActionButton,
    } = props;

    return {
      partyId,
      onRowTap: onOpenQuoteRequest,
      onMissingNamesAction: onOpenManagePartyPageRequest,
      openNewLease: onOpenNewLeaseRequest,
      openReviewApplication: onOpenReviewApplicationRequest,
      quotePromotions,
      members: partyMembers,
      applicantsWithDisclosures,
      canReviewApplication,
      isApplicationHeld: partyApplicationOnHold,
      screeningExpirationResults,
      promotedQuotes,
      displayActionButton,
      onApprove: this.handleOnApproveApplication,
    };
  }

  render() {
    const { isCorporateParty, hasQuotes, timezone } = this.props;
    const transToken = isCorporateParty ? 'CORPORATE_NO_QUOTES_HAVE_BEEN_CREATED' : 'NO_QUOTES_HAVE_BEEN_CREATED';
    let content = <EmptyMessage message={t(transToken)} dataId="noQuotesMessage" />;
    if (hasQuotes) {
      content = <QuoteList timezone={timezone} className={cf('quotes')} {...this.quoteListProps} />;
    }
    return <Section>{content}</Section>;
  }
}
