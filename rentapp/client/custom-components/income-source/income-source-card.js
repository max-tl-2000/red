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
import { Typography } from 'components';
import { cf, g } from './income-source-card.scss';
import { RentappTypes } from '../../../common/enums/rentapp-types';
import { getFormattedIncome } from '../../helpers/utils';
import { USD } from '../../../../common/currency';

const { Text, Caption } = Typography;

@observer
export default class IncomeSourceCard extends Component {
  static propTypes = {
    item: PropTypes.object,
    onItemSelected: PropTypes.func,
  };

  handleOnTouchTapItem = e => {
    const { onItemSelected, item } = this.props;
    onItemSelected && onItemSelected(e, item);
  };

  mustDisplayOnlySourceType = item => item.incomeSourceType !== RentappTypes.IncomeSourceType.OTHER_SOURCE || !item.sourceDescription;

  mustDisplayEmployerName = item => item.incomeSourceType === RentappTypes.IncomeSourceType.EMPLOYMENT && item.employerName;

  getSourceTypeWithDescription = item =>
    t('INCOME_SOURCE_WITH_DESCRIPTION', {
      incomeSource: t(`${item.incomeSourceType}_LABEL`),
      description: item.sourceDescription,
    });

  getFormattedIncomeSource = item => {
    if (this.mustDisplayOnlySourceType(item)) {
      return t(`${item.incomeSourceType}_LABEL`);
    }
    return this.getSourceTypeWithDescription(item);
  };

  render() {
    const { item, className } = this.props;

    return (
      <div className={cf('income-source-card', g(className))} onClick={this.handleOnTouchTapItem}>
        <Caption secondary>{this.getFormattedIncomeSource(item)}</Caption>
        {this.mustDisplayEmployerName(item) && <Text>{item.employerName}</Text>}
        {
          <Text>
            {getFormattedIncome({
              income: item.grossIncome,
              frequency: item.grossIncomeFrequency,
              currency: USD.code,
            })}
          </Text>
        }
      </div>
    );
  }
}
