/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { closeNoLeaseTemplatesWarning, getScreeningForParty } from 'redux/modules/quotes';
import NoLeaseTemplateWarningDialog from '../ProspectDetailPage/NoLeaseTemplateWarningDialog';
import { getLeases, personsInParty, getQuotePromotions, isCorporateParty } from '../../redux/selectors/partySelectors';
import LeaseStatusList from '../LeaseStatusList/LeaseStatusList';

@connect(
  (state, props) => ({
    userToken: state.auth.token,
    users: state.globalStore.get('users'),
    isLeaseTemplateMissing: state.quotes.isLeaseTemplateMissingWarning,
    quotes: state.quotes.quotes,
    screeningSummary: state.quotes.screeningSummary,
    leases: getLeases(state, props),
    persons: personsInParty(state, props),
    quotePromotions: getQuotePromotions(state, props),
    partyIsCorporate: isCorporateParty(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        closeNoLeaseTemplatesWarning,
        getScreeningForParty,
      },
      dispatch,
    ),
)
export default class LeaseListWrapper extends Component {
  handleReviewLease = lease => {
    if (!lease) return;
    const { dlgLeaseForm } = this.props;
    dlgLeaseForm.setSelectedLeaseIdAndOpen(lease.id);
  };

  componentWillMount() {
    const { party } = this.props;
    this.props.getScreeningForParty({ partyId: party.id });
  }

  componentWillReceiveProps(nextProps) {
    const { props } = this;
    const { isLeaseTemplateMissing, dlgLeaseForm } = props;

    if (nextProps.isLeaseTemplateMissing !== isLeaseTemplateMissing && nextProps.isLeaseTemplateMissing === true) {
      dlgLeaseForm.clearSelectedLeaseAndClose();
    }
  }

  render() {
    const { props } = this;
    const {
      isLeaseTemplateMissing,
      persons,
      users,
      party,
      leases,
      quotes,
      quotePromotions,
      partyIsCorporate,
      screeningSummary,
      isRenewal,
      handleOpenManageParty,
    } = props;

    return (
      <div data-id="leaseSection">
        <LeaseStatusList
          persons={persons}
          users={users}
          isCorporateParty={partyIsCorporate}
          party={party}
          leases={leases.toArray()}
          quotes={quotes}
          quotePromotions={quotePromotions}
          onReviewLease={this.handleReviewLease}
          screeningSummary={screeningSummary}
          isRenewal={isRenewal}
          handleOpenManageParty={handleOpenManageParty}
        />
        <NoLeaseTemplateWarningDialog open={isLeaseTemplateMissing} closeDialog={props.closeNoLeaseTemplatesWarning} />
      </div>
    );
  }
}
