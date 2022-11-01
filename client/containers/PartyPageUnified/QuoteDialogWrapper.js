/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import QuoteDraft from 'containers/Quotes/Draft/QuoteDraft';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { observer } from 'mobx-react';
import { action, reaction } from 'mobx';
import { getPartyMembersThatCanApply, getSelectedQuoteModel } from 'redux/selectors/partySelectors';
import isEqual from 'lodash/isEqual';
import { fetchQuotes, saveQuoteDialogOpenState } from '../../redux/modules/quotes';

@connect(
  (state, props) => ({
    selectedQuoteModel: getSelectedQuoteModel(state, props),
    membersThanCanApply: getPartyMembersThatCanApply(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchQuotes,
        saveQuoteDialogOpenState,
      },
      dispatch,
    ),
)
@observer
export default class QuoteDialogWrapper extends Component {
  constructor(props) {
    super(props);
    const { model, selectedQuoteModel } = props;

    if (selectedQuoteModel) {
      model.setSelectedQuote(selectedQuoteModel);
    }
  }

  componentWillMount() {
    const { model } = this.props;
    this.stopWatchingDialogState = reaction(
      () => ({
        open: model.isOpen,
      }),
      ({ open }) => this.props.saveQuoteDialogOpenState(open),
    );
  }

  componentWillUnmount() {
    const { stopWatchingDialogState } = this;
    stopWatchingDialogState && stopWatchingDialogState();
  }

  componentWillReceiveProps(nextProps) {
    const { props } = this;

    if (!isEqual(nextProps.selectedQuoteModel, props.selectedQuoteModel)) {
      props.model.setSelectedQuote(nextProps.selectedQuoteModel);
    }
  }

  @action
  handleCloseRequest = () => {
    const { props } = this;
    const { partyId, model } = props;
    if (!partyId) return;

    model.closeQuote();
    props.fetchQuotes(partyId);
  };

  render() {
    const { props } = this;
    const { filters, model, partyId, membersThanCanApply, openCommFlyOut, timezone, activeLeaseWorkflowData } = props;
    return (
      <QuoteDraft
        timezone={timezone}
        activeLeaseWorkflowData={activeLeaseWorkflowData}
        moveInFromDate={filters && filters.moveInDate ? filters.moveInDate.min : null}
        open={model.isOpen}
        selectedInventory={model.selectedInventory}
        partyId={partyId}
        onCloseRequest={this.handleCloseRequest}
        openCommFlyOut={openCommFlyOut}
        quote={model.selectedQuote}
        partyMembers={membersThanCanApply}
        onOpenOrCreateQuoteDraft={model.openOrCreateQuote}
        isRenewalQuote={model.isRenewalQuote}
      />
    );
  }
}
