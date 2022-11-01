/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { Typography } from 'components';
import { t } from 'i18next';
import { cf } from './PaymentScheduleSection.scss';

import PaymentScheduleCard from './PaymentScheduleCard';

const { Text, Caption } = Typography;

@observer
class PaymentScheduleSection extends React.Component {
  static propTypes = {
    quoteModel: PropTypes.object,
    prorationStrategy: PropTypes.string,
  };

  get selectedTerm() {
    return this.props.quoteModel.selectedTerm;
  }

  renderPaymentScheduleCards = leaseTerm => {
    const { quoteModel, prorationStrategy } = this.props;
    const { selectedLeaseTermIds, leaseStartDate } = quoteModel;

    const additionalCharges = quoteModel.additionalAndOneTimeCharges.find(p => p.name === this.selectedTerm.period);
    const isSelectedTerm = leaseStartDate && selectedLeaseTermIds.find(selected => selected === leaseTerm.id);
    let paymentScheduleCard = null;

    if (isSelectedTerm) {
      paymentScheduleCard = (
        <div className={cf('card')} key={leaseTerm.id}>
          <PaymentScheduleCard
            leaseTerm={leaseTerm}
            leaseStartDate={leaseStartDate}
            additionalCharges={additionalCharges}
            prorationStrategy={prorationStrategy}
          />
        </div>
      );
    }
    return paymentScheduleCard;
  };

  render() {
    const { leaseTerms } = this.props.quoteModel;
    return (
      <div className={cf('section-content')}>
        <div className={cf('section-title')}>
          <Text bold>{t('PAYMENT_SCHEDULE_SECTION_TITLE')}</Text>
          <Caption>{t('PAYMENT_SCHEDULE_NO_ONE_TIME_CHARGES')}</Caption>
        </div>
        <div className={cf('section-cards')}>{leaseTerms && leaseTerms.map(this.renderPaymentScheduleCards)}</div>
      </div>
    );
  }
}

export default PaymentScheduleSection;
