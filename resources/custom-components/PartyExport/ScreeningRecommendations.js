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
import sass from 'node-sass';
import path from 'path';
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import { formatMoment } from '../../../common/helpers/moment-utils';
import { formatMoney } from '../../../common/money-formatter';
import { getUserFriendlyStatus } from '../../../common/helpers/applicants-utils';
import createElement from './create-element';
const Text = createElement('text');

@observer
export default class ScreeningRecommendations extends Component {
  static propTypes = {
    screeningResults: PropTypes.array,
  };

  static styles = [sass.renderSync({ file: path.resolve(__dirname, './Table.scss') }).css.toString()];

  getPriceAndTerm = rentData => {
    const { result: formattedAmount } = formatMoney({
      amount: rentData.rent,
      currency: 'USD',
    });

    return `${formattedAmount}/${rentData.leaseTermMonths}m`;
  };

  getScreeningRecommendation = applicationDecision => getUserFriendlyStatus(applicationDecision);

  getDetailedScreeningRecommendation = recommendations => recommendations?.map(rec => rec.text).join(' ');

  renderHeader = () => (
    <div className="table-record">
      <div>
        <Text style={{ fontSize: 7, fontWeight: 'bold' }}> {t('QUOTES_TABLE_COLUMN_UNIT_NAME')} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7, fontWeight: 'bold' }}> {t('LEASE_START')} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7, fontWeight: 'bold' }}> {t('QUOTES_TABLE_COLUMN_LEASE_TERM')} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7, fontWeight: 'bold' }}> {t('SCREENING_RECOMMENDATIONS')} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7, fontWeight: 'bold' }}> {t('DETAILED_RECOMMENDATION')} </Text>
      </div>
    </div>
  );

  renderRow = (result, key) => (
    <div className="table-record" key={key}>
      <div>
        <Text style={{ fontSize: 7 }}> {result.quoteAndInventory.inventoryName} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7 }}> {`${formatMoment(result.quoteAndInventory.quote.leaseStartDate, { format: MONTH_DATE_YEAR_FORMAT })}`} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7 }}> {this.getPriceAndTerm(result.rentData)} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7 }}> {this.getScreeningRecommendation(result.applicationDecision)} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7 }}> {this.getDetailedScreeningRecommendation(result.recommendations)} </Text>
      </div>
    </div>
  );

  render() {
    const { screeningResults } = this.props;

    return (
      <div className="records">
        {this.renderHeader()}
        {screeningResults?.map((result, index) => this.renderRow(result, index))}
      </div>
    );
  }
}
