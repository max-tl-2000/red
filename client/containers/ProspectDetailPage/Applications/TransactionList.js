/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { RedTable, Typography } from 'components';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { cf } from './TransactionList.scss';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { renderFullQualifiedName } from '../../Inventory/InventoryHelper';
import { formatTimestamp } from '../../../../common/helpers/date-utils';

const { Text } = Typography;
const { Table, Row, RowHeader, Cell, Money } = RedTable;

@connect(state => ({
  transactions: state.partyStore.transactions,
}))
export default class TransactionList extends Component {
  isNegativeTransaction = transactionType =>
    transactionType === DALTypes.PaymentTransactionType.REFUND ||
    transactionType === DALTypes.PaymentTransactionType.VOID ||
    transactionType === DALTypes.PaymentTransactionType.WAIVER;

  getTokenForTransactionDescription = transactionType => {
    switch (transactionType) {
      case DALTypes.PaymentTransactionType.REFUND:
        return 'TRANSACTION_LIST_REFUND_DESCRIPTION_FEE_PAYER';
      case DALTypes.PaymentTransactionType.VOID:
        return 'TRANSACTION_LIST_VOID_DESCRIPTION_FEE_PAYER';
      case DALTypes.PaymentTransactionType.WAIVER:
        return 'TRANSACTION_LIST_WAIVER_FEE_DESCRIPTION_FEE_PAYER';
      default:
        return 'TRANSACTION_LIST_DESCRIPTION_FEE_PAYER';
    }
  };

  renderDescription = ({ feeName, payer, unitName, transactionType, wasPaidInADifferentParty }) => {
    const from = t(this.getTokenForTransactionDescription(transactionType), {
      feeName,
      payer,
    });

    const contentDescription = unitName
      ? [
          <Text key={`${feeName}-list-description`} inline>{`${from} ${t('TRANSACTION_LIST_DESCRIPTION_UNIT')}`}</Text>,
          renderFullQualifiedName(unitName, false),
        ]
      : [
          <Text key={`${feeName}-list-description`} inline>
            {from}
          </Text>,
        ];

    wasPaidInADifferentParty &&
      contentDescription.push(
        <Text secondary inline className={cf('text-suffix')} key={`key-${Date.now()}`} data-id="paidInADifferentParty">
          {`- ${t('PAID_IN_A_DIFFERENT_PARTY')}`}
        </Text>,
      );
    return contentDescription;
  };

  renderRow = (transaction, key) => (
    <Row key={`row-${transaction.feeId}-${key}`}>
      <Cell className={cf('text-description')}>
        <Text>{this.renderDescription(transaction)}</Text>
        {transaction.feeWaiverReason && <Text secondary>{transaction.feeWaiverReason}</Text>}
      </Cell>
      <Cell width={220} className={cf('text-cell')}>
        <Text>{formatTimestamp(transaction.date, { timezone: this.props.timezone })}</Text>
      </Cell>
      <Cell width={120} textAlign="right">
        <Money amount={(this.isNegativeTransaction(transaction.transactionType) ? -1 : 1) * transaction.amount} dataId={`transactionAmount${key + 1}`} />
      </Cell>
      <Cell width={80} />
    </Row>
  );

  render({ transactions } = this.props) {
    let content;
    if (!(transactions && transactions.length)) {
      content = <EmptyMessage message={t('PAYMENTS_FEES_SECTION_EMPTY_STATE')} className={cf('empty-message')} dataId="noPaymentsMessage" />;
    } else {
      content = (
        <Table>
          <RowHeader>
            <Cell>{t('TRANSACTION_LIST_COLUMN_DESCRIPTION')}</Cell>
            <Cell width={220}>{t('TRANSACTION_LIST_COLUMN_DATE')}</Cell>
            <Cell width={120} textAlign="right">
              {t('TRANSACTION_LIST_COLUMN_AMOUNT')}
            </Cell>
            <Cell width={80} />
          </RowHeader>
          {transactions && transactions.map((transaction, key) => this.renderRow(transaction, key))}
        </Table>
      );
    }

    return <div className={cf('transactionList')}>{content}</div>;
  }
}
