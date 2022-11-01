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
import { Typography as T } from 'components';
import { cf, g } from './address-card.scss';
import { RentappTypes } from '../../../common/enums/rentapp-types';
import { formatPhoneToDisplay } from '../../../../common/helpers/phone/phone-helper';
import { SHORT_MONTH_YEAR_FORMAT } from '../../../../common/date-constants';
import { formatMoment } from '../../../../common/helpers/moment-utils';

@observer
export default class AddressCard extends Component {
  static propTypes = {
    item: PropTypes.object,
    onItemSelected: PropTypes.func,
  };

  handleOnTouchTapItem = e => {
    const { onItemSelected, item } = this.props;
    onItemSelected && onItemSelected(e, item);
  };

  render() {
    const { item, className } = this.props;
    const isOwned = item.ownOrRent === RentappTypes.PropertyType.OWN;
    const lines = [];

    const addLine = (text, isHeader = false) => lines.push({ isHeader, text });

    const renderLine = (key, isHeader, text) =>
      isHeader ? (
        <T.Text key={key} bold>
          {text}
        </T.Text>
      ) : (
        <T.Text secondary key={key}>
          {text}
        </T.Text>
      );

    const getFormattedAmount = monthlyPayment => ({
      currency: t('MONTHLY_PAYMENT_CURRENCY'),
      amount: monthlyPayment,
    });

    const formatPropertyTypeWithPayment = () => {
      const hasAmount = item.monthlyPayment;
      if (!hasAmount) return isOwned ? t('OWNED') : t('RENTED');
      const formattedPayment = getFormattedAmount(item.monthlyPayment);
      return t(isOwned ? 'OWNED_FOR' : 'RENTED_FOR', formattedPayment);
    };

    // strs is an array alternating string content and separators.  Separators are appended
    // only if their previous string content is not empty.
    const formatTextList = (...strs) => {
      const ret = [];
      while (strs.length) {
        const str = strs.shift() || '';
        const sep = strs.shift() || '';
        ret.push(str, str ? sep : '');
      }
      return ret.join('');
    };

    const renderDetail = () => {
      addLine(formatPropertyTypeWithPayment(), true);

      if (item.moveInDate) {
        // TODO: Ask Avantica: Should this need the timezone?
        addLine(t('FROM_DATE', { date: formatMoment(item.moveInDate, { format: SHORT_MONTH_YEAR_FORMAT }) }));
      }

      if (item.hasInternationalAddress) {
        if (item.addressLine) addLine(item.addressLine);
      } else {
        if (item.addressLine1) addLine(item.addressLine1);
        if (item.city || item.state || item.zip) {
          addLine(formatTextList(item.city, ',', item.state, ' ', item.zip));
        }
      }

      if (!isOwned && (item.ownerName || item.ownerPhone)) {
        addLine(formatTextList(item.ownerName, ',', formatPhoneToDisplay(item.ownerPhone)));
      }

      return lines.map((line, i) => renderLine(i, line.isHeader, line.text));
    };

    return (
      <div className={cf('address-card', g(className))} onClick={this.handleOnTouchTapItem}>
        {renderDetail()}
      </div>
    );
  }
}
