/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import createElement from './create-element';
import { RentappTypes } from '../../../rentapp/common/enums/rentapp-types';
import { USD } from '../../../common/currency';
import { formatMoney } from '../../../common/money-formatter';

const Text = createElement('text');
const Caption = createElement('caption');

const getFormattedIncome = item => {
  if (!item.income) return t(item.frequency);
  const { result: formatted, integerPart, decimalPart } = formatMoney({ amount: item.income, currency: item.currency });
  const formattedIncome = decimalPart > 0 ? formatted : integerPart;

  if (!item.frequency) return formattedIncome;
  return t('INCOME_WITH_FREQUENCY', { income: formattedIncome, frequency: t(`${item.frequency}`) });
};

@observer
export default class IncomeSourceCard extends Component {
  static propTypes = {
    item: PropTypes.object,
  };

  mustDisplayOnlySourceType = item => item.incomeSourceType !== RentappTypes.IncomeSourceType.OTHER_SOURCE || !item.sourceDescription;

  mustDisplayEmployerName = item => item.incomeSourceType === RentappTypes.IncomeSourceType.EMPLOYMENT && item.employerName;

  getSourceTypeWithDescription = item =>
    t('INCOME_SOURCE_WITH_DESCRIPTION', { incomeSource: t(`${item.incomeSourceType}_LABEL`), description: item.sourceDescription });

  getFormattedIncomeSource = item => {
    if (this.mustDisplayOnlySourceType(item)) return t(`${item.incomeSourceType}_LABEL`);
    return this.getSourceTypeWithDescription(item);
  };

  render() {
    const { item, className } = this.props;

    return (
      <div className={`card ${className}`}>
        <Caption secondary style={{ fontSize: 7 }}>
          {this.getFormattedIncomeSource(item)}
        </Caption>
        {this.mustDisplayEmployerName(item) && <Text style={{ fontSize: 7 }}>{item.employerName}</Text>}
        {<Text style={{ fontSize: 7 }}>{getFormattedIncome({ income: item.grossIncome, frequency: item.grossIncomeFrequency, currency: USD.code })}</Text>}
      </div>
    );
  }
}
