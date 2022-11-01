/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { getActiveQuotePromotion, getLeases, getPromotedQuotes, isCorporateParty, getQuotePromotions } from 'redux/selectors/partySelectors';
import { DALTypes } from 'enums/DALTypes';
import { t } from 'i18next';
import { Button } from 'components';
import { isUserAllowedToReviewApplication, getApplicantsWithDisclosures } from 'redux/selectors/applicationSelectors';
import { observer } from 'mobx-react';
import { action } from 'mobx';
import { isReadOnlyLease } from 'redux/selectors/leaseSelectors';
import { isApplicationApprovable, searchQuotePromotion } from '../../../common/helpers/quotes';
import ApplicationSummaryPage from '../ApplicationSummary/ApplicationSummaryPage';
import ApplicationProgressForPartyPage from '../ProspectDetailPage/Applications/ApplicationProgressForPartyPage';
import { updateQuotePromotion, promoteQuote } from '../../redux/modules/quotes';

const getQuoteByQuoteId = (quotes, quoteId) => quotes.find(quote => quote.id === quoteId);

@connect(
  (state, props) => {
    const partyIsCorporate = isCorporateParty(state, props);
    const quotePromotions = getQuotePromotions(state, props);
    const quotePromotion = getActiveQuotePromotion(state, props);
    const promotedQuotes = getPromotedQuotes(state, props);

    const { quotes } = state.quotes;
    const hasQuotes = quotes && quotes.length && quotes.some(quote => !quote.pristine);

    const leases = getLeases(state, props);

    // should these be selectors?
    const hasApplicationRequireWorkStatus = !!quotePromotion && quotePromotion.promotionStatus === DALTypes.PromotionStatus.REQUIRES_WORK;
    const hasALease = !!leases.find(lease => lease.status !== DALTypes.LeaseStatus.VOIDED);

    const promotedQuote = hasQuotes
      ? (quotePromotion && getQuoteByQuoteId(promotedQuotes, quotePromotion.quoteId)) || getQuoteByQuoteId(quotes, props.selectedQuoteId)
      : null;

    const canReviewApplication = isUserAllowedToReviewApplication(state, props);
    const hasPendingApplicationApproval =
      !partyIsCorporate && quotePromotions && quotePromotions.some(promotion => isApplicationApprovable(promotion.promotionStatus));
    const showReviewApplicationButton = canReviewApplication && hasPendingApplicationApproval && !hasApplicationRequireWorkStatus;
    const screeningApplicationDecision = props.screeningSummary.recommendation || props.applicationDecision;

    return {
      showReviewApplicationButton,
      quotePromotion,
      hasApplicationRequireWorkStatus,
      leases,
      hasALease,
      quotes,
      promotedQuote,
      canReviewApplication,
      quotePromotions,
      selectorData: state.partyStore.selectorData,
      isLeaseTemplateMissing: state.quotes.isLeaseTemplateMissingWarning,
      getApplicantsWithDisclosures: getApplicantsWithDisclosures(state, props),
      readOnlyLease: isReadOnlyLease(state, props),
      screeningApplicationDecision,
    };
  },
  dispatch =>
    bindActionCreators(
      {
        updateQuotePromotion,
        promoteQuote,
      },
      dispatch,
    ),
)
@observer
export default class ApplicationProgressWrapper extends Component {
  componentWillReceiveProps(nextProps) {
    if (nextProps.isLeaseTemplateMissing && nextProps.isLeaseTemplateMissing !== this.props.isLeaseTemplateMissing) {
      this.props.dlgApplicationSummary.close();
    }
  }

  handleOnCreateLease = createLeaseModel =>
    this.handleDecisionApplication({ decisionModel: createLeaseModel, promotionStatus: DALTypes.PromotionStatus.APPROVED, createApprovalTask: false });

  // shouldn't create review application task then createApprovalTask = false
  handleOnApproveApplication = approvalModel =>
    this.handleDecisionApplication({ decisionModel: approvalModel, promotionStatus: DALTypes.PromotionStatus.APPROVED, createApprovalTask: false });

  handleOnDeclineApplication = declineModel =>
    this.handleDecisionApplication({ decisionModel: declineModel, promotionStatus: DALTypes.PromotionStatus.CANCELED, createApprovalTask: false });

  handleRequestApproval = () => this.handleDecisionApplication({ promotionStatus: DALTypes.PromotionStatus.PENDING_APPROVAL, createApprovalTask: true });

  handleOnRevokeApplication = () => {
    this.props.dlgApplicationSummary.close();
  };

  @action
  handleDecisionApplication = async ({ decisionModel, promotionStatus, createApprovalTask }) => {
    const { props } = this;

    const { quotePromotions, partyId, onOpenLeaseFormRequest, selectedLeaseTermId, selectedQuoteId, quotePromotion } = props;

    let promotion = quotePromotion;
    let lease;
    if (!quotePromotions.size || !quotePromotion) {
      const requestData = {
        partyId,
        quoteId: selectedQuoteId,
        leaseTermId: selectedLeaseTermId,
      };
      const quotePromotionData = (await this.props.promoteQuote({ ...requestData }, promotionStatus, createApprovalTask, decisionModel)) || {};
      if (!quotePromotionData.quotePromotion) return;
      promotion = quotePromotionData.quotePromotion;
      lease = quotePromotionData.lease;
    }

    promotion = searchQuotePromotion(promotion, quotePromotions, promotionStatus);
    const isPendingStatus = promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL;
    lease = lease || (!isPendingStatus && (await props.updateQuotePromotion(partyId, promotion.id, promotionStatus, decisionModel)));

    if (promotionStatus === DALTypes.PromotionStatus.APPROVED) {
      if (lease) {
        onOpenLeaseFormRequest && onOpenLeaseFormRequest(lease);
      }
    } else {
      props.dlgApplicationSummary.close();
    }
  };

  render() {
    const { props } = this;

    const {
      quotePromotion,
      hasApplicationRequireWorkStatus,
      showReviewApplicationButton,
      leases,
      quotes,
      canReviewApplication,
      onOpenReviewApplicationRequest,
      hasALease,
      promotedQuote,
      partyId,
      selectorData,
      screeningSummary,
      partyMembers,
      applicantsAndDisclosures,
      renderQuotes,
      selectedLeaseTermId,
      hasActivePromotionForQuote,
      screeningApplicationDecision,
      selectedLeaseTerm,
    } = props;

    return (
      <div>
        {hasActivePromotionForQuote && (
          <ApplicationProgressForPartyPage
            quotePromotion={quotePromotion}
            hasApplicationRequireWorkStatus={hasApplicationRequireWorkStatus}
            leases={leases}
            quotes={quotes}
            canReviewApplication={canReviewApplication}
            onReviewApplicationClicked={onOpenReviewApplicationRequest}
            renderQuotes={renderQuotes}
            hasALease={hasALease}>
            {/* Temporary Layout: Start - CPM-4683 */}
            {showReviewApplicationButton && (
              <Button
                id="reviewApplicationBtn"
                style={{ marginTop: '1rem' }}
                type="raised"
                btnRole="primary"
                label={t('REVIEW_APPLICATION')}
                onClick={onOpenReviewApplicationRequest}
              />
            )}
            {promotedQuote && props.dlgApplicationSummary.isOpen && (
              <ApplicationSummaryPage
                open={props.dlgApplicationSummary.isOpen}
                onCloseRequest={props.dlgApplicationSummary.close}
                partyId={partyId}
                selectorData={selectorData}
                quote={promotedQuote}
                screeningSummary={screeningSummary}
                screeningDelayedDecision={selectedLeaseTerm?.screening?.delayedDecision}
                quotePromotion={quotePromotion}
                onApprove={this.handleOnApproveApplication}
                onDecline={this.handleOnDeclineApplication}
                onCreateLease={this.handleOnCreateLease}
                members={partyMembers}
                applicantsWithDisclosures={applicantsAndDisclosures}
                hasALease={hasALease}
                selectedLeaseTermId={selectedLeaseTermId}
                canReviewApplication={canReviewApplication}
                screeningApplicationDecision={screeningApplicationDecision}
                onRequestApproval={this.handleRequestApproval}
                onRevokeApplication={this.handleOnRevokeApplication}
              />
            )}
            {/* End - CPM-4683 */}
          </ApplicationProgressForPartyPage>
        )}
        {!hasActivePromotionForQuote && promotedQuote && props.dlgApplicationSummary.isOpen && (
          <ApplicationSummaryPage
            open={props.dlgApplicationSummary.isOpen}
            onCloseRequest={props.dlgApplicationSummary.close}
            partyId={partyId}
            selectorData={selectorData}
            quote={promotedQuote}
            screeningSummary={screeningSummary}
            screeningDelayedDecision={selectedLeaseTerm?.screening?.delayedDecision}
            quotePromotion={quotePromotion}
            onApprove={this.handleOnApproveApplication}
            onDecline={this.handleOnDeclineApplication}
            onCreateLease={this.handleOnCreateLease}
            members={partyMembers}
            applicantsWithDisclosures={applicantsAndDisclosures}
            hasALease={hasALease}
            selectedLeaseTermId={selectedLeaseTermId}
            canReviewApplication={canReviewApplication}
            screeningApplicationDecision={screeningApplicationDecision}
            onRequestApproval={this.handleRequestApproval}
            onRevokeApplication={this.handleOnRevokeApplication}
          />
        )}
      </div>
    );
  }
}
