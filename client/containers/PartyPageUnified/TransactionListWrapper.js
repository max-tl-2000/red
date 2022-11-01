/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { Section } from 'components';
import { connect } from 'react-redux';
import TransactionList from '../ProspectDetailPage/Applications/TransactionList';

@connect(state => ({
  transactions: state.partyStore.transactions,
}))
export default class TransactionListWrapper extends Component {
  get paymentsAndFeesHelpterText() {
    const { transactions } = this.props;
    return transactions && transactions.length ? t('PAYMENTS_AND_FEES_SUBTITLE') : '';
  }

  render() {
    const { props, paymentsAndFeesHelpterText } = this;
    const { partyId, timezone } = props;

    return (
      <Section data-id="paymentsAndFeesSection" padContent={false} title={t('PAYMENTS_AND_FEES')} helperText={paymentsAndFeesHelpterText}>
        <TransactionList partyId={partyId} timezone={timezone} />
      </Section>
    );
  }
}
