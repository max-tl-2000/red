/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { RedTable, Typography, Card } from 'components';
import injectProps from 'helpers/injectProps';
import { termText } from 'helpers/quotes';

import { getPeriodAmountsForLeaseTerm } from '../../../../common/helpers/quotes';
import { convertToCamelCaseAndRemoveBrackets } from '../../../../common/helpers/strings';

import { cf } from './PaymentScheduleCard.scss';

const { SubHeader } = Typography;

const { Table, Row, Cell, Money, TextPrimary } = RedTable;

@observer
class PaymentScheduleCard extends React.Component {
  static propTypes = {
    leaseTerm: PropTypes.object,
    leaseStartDate: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    additionalCharges: PropTypes.object,
    prorationStrategy: PropTypes.string,
  };

  renderPaymentRows() {
    const { leaseTerm, leaseStartDate, additionalCharges, prorationStrategy, timezone } = this.props;
    const periodAmounts = getPeriodAmountsForLeaseTerm({
      leaseTerm,
      leaseStartDate,
      additionalCharges,
      prorationStrategy,
      timezone,
    });

    return periodAmounts.map((period, i) => {
      const isNegative = Math.sign(period.amount);
      const amount = Math.abs(period.amount);
      // TODO: We need to find a proper id here
      // eslint-disable-next-line react/no-array-index-key
      const key = i;
      return (
        <Row key={key} className={cf('row-header-custom')}>
          <Cell width={196} className={cf('no-padding-cell')} textAlign="left">
            {period.timeframe}
          </Cell>
          <Cell className={cf('no-padding-cell')} textAlign="right">
            {isNegative === -1 && <TextPrimary inline>{'-'}</TextPrimary>}
            <Money data-id={i} className={cf('payment-amount')} amount={amount} />
          </Cell>
        </Row>
      );
    });
  }

  @injectProps
  render() {
    const theTermLength = termText(this.props.leaseTerm);
    return (
      <Card data-id={`${convertToCamelCaseAndRemoveBrackets(theTermLength)}_card`}>
        <SubHeader data-id={convertToCamelCaseAndRemoveBrackets(theTermLength)}>
          {t('PAYMENT_SCHEDULE_CARD_TITLE', {
            length: theTermLength,
          })}
        </SubHeader>
        {this.props.leaseTerm && (
          <Table dataId={`${convertToCamelCaseAndRemoveBrackets(theTermLength)}_table`} type="readOnly">
            {this.renderPaymentRows()}
          </Table>
        )}
      </Card>
    );
  }
}

export default PaymentScheduleCard;
