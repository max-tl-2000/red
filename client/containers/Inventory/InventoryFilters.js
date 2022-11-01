/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Typography as T } from 'components';
import { cf } from './InventoryFilters.scss';
import Money from '../../components/Table/Money';
import { getMoveInDateSummary, getSortedAndFormattedNumBedroomsForFilters, getSortedAndFormattedFloorForFilters } from '../../helpers/unitsUtils';
import { PRICE_FILTER_MAX } from '../../helpers/priceRangeConstants';

export default class InventoryFilters extends Component {
  static propTypes = {
    filters: PropTypes.object,
    timezone: PropTypes.string.isRequired,
  };

  renderPriceRangeMaxAmount = maxAmount => {
    const shouldShowPlusSymbol = maxAmount >= PRICE_FILTER_MAX;

    if (shouldShowPlusSymbol) {
      return (
        <span className={cf('priceSummary')}>
          <Money className={cf('marketRent')} secondary noDecimals amount={PRICE_FILTER_MAX} />
          <T.Caption secondary>+</T.Caption>
        </span>
      );
    }

    return <Money className={cf('marketRent')} secondary noDecimals amount={maxAmount} />;
  };

  getPriceRangeSummary = marketRent => (
    <span className={cf('priceSummary')}>
      <Money className={cf('marketRent')} secondary noDecimals amount={marketRent.min} />
      <span className={cf('minusSymbol')}> - </span>
      {this.renderPriceRangeMaxAmount(marketRent.max)}
    </span>
  );

  renderFilter = (label, filter) => {
    if (!filter) {
      return '';
    }

    return (
      <div>
        <T.Caption secondary style={{ display: 'flex', lineHeight: '22px' }} data-id={`${t(label)}_inventoryFilterPillText`}>
          {t(label)}: {filter}
        </T.Caption>
      </div>
    );
  };

  render({ timezone, filters: { numBedrooms, moveInDate, marketRent, floor, amenities, unitName } } = this.props) {
    const hasPriceRange = !!marketRent && (!!marketRent.min || !!marketRent.max);

    const bedroomsFilters = getSortedAndFormattedNumBedroomsForFilters(numBedrooms);
    const moveInDateFormated = getMoveInDateSummary(moveInDate, { timezone });
    const priceRangeFilter = hasPriceRange && this.getPriceRangeSummary(marketRent);
    const floorFilter = getSortedAndFormattedFloorForFilters(floor);
    const amenitiesFilter = amenities && amenities.items && amenities.items.map(e => e.text).join(', ');
    const unitNameSearchText = unitName && `"${unitName}"`;

    const hasFilters = bedroomsFilters || moveInDate || priceRangeFilter || floorFilter || amenitiesFilter || unitNameSearchText;
    return (
      !!hasFilters &&
      (!unitName ? (
        <div className={cf('selectedFilters')}>
          {this.renderFilter('LABEL_BEDS', bedroomsFilters)}
          {this.renderFilter('LABEL_DATE', moveInDateFormated)}
          {this.renderFilter('PRICE_RANGE_LABEL', priceRangeFilter)}
          {this.renderFilter('LABEL_FLOOR', floorFilter)}
          {this.renderFilter('AMENITIES_LABEL', amenitiesFilter)}
        </div>
      ) : (
        <div className={cf('selectedFilters')}>{this.renderFilter('LABEL_SEARCH_UNITS', unitNameSearchText)}</div>
      ))
    );
  }
}
