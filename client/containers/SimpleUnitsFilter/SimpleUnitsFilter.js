/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from 'i18next';

import * as inventoryActions from 'redux/modules/inventoryStore';
import * as layoutsActions from 'redux/modules/layoutsStore';
import * as amenitiesActions from 'redux/modules/amenityStore';
import * as unitsFilters from 'redux/modules/unitsFilter';
import { AutoSize, ButtonBar, RangeSlider, SelectionGroup, Typography as T } from 'components';
import DateRange from 'components/DateSelector/DateRange';
import Money from 'components/Table/Money';
import NumberOfUnits from 'custom-components/NumberOfUnits/NumberOfUnits';
import { cf } from './SimpleUnitsFilter.scss';
import {
  bedroomsArray2DataSource,
  floorAmountToClosestMultiple,
  ceilAmountToClosestMultiple,
  formatFloorLevels,
  getAmenitiesForProperties,
  getFloorsForProperties,
} from '../../helpers/unitsUtils';

import { DALTypes } from '../../../common/enums/DALTypes';
import { PRICE_FILTER_MAX } from '../../helpers/priceRangeConstants';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';
import { toMoment } from '../../../common/helpers/moment-utils';

@connect(
  (state, props) => ({
    prospectError: state.inventoryStore.prospectError,
    filters: state.unitsFilter.filters,
    pushStatus: state.unitsFilter.pushStatus,

    // data for components
    marketRentRange: state.inventoryStore.marketRentRange,
    timezone: getPartyTimezone(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        ...inventoryActions,
        ...layoutsActions,
        ...amenitiesActions,
        ...unitsFilters,
      },
      dispatch,
    ),
)
export default class SimpleUnitsFilter extends Component {
  static propTypes = {
    prospectError: PropTypes.object,
    loadLayouts: PropTypes.func,
    properties: PropTypes.array,

    // advanced filter props
    filters: PropTypes.object,
    onDone: PropTypes.func,
    pushStatus: PropTypes.string,
    numberOfUnits: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onSubmitNumberOfUnits: PropTypes.func,
    isCorporateParty: PropTypes.bool,
    isInventoryListVisible: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    this.state = {
      numberOfUnits: props.numberOfUnits,
    };
    const bedroomOptions = DALTypes.QualificationQuestions.BedroomOptions;
    this.numBedrooms = bedroomsArray2DataSource(bedroomOptions);
  }

  componentWillReceiveProps(nextProps) {
    const { numberOfUnits } = nextProps;
    if (numberOfUnits !== this.state.numberOfUnits) {
      this.setState({ numberOfUnits });
    }
  }

  // update a filter in the redux store
  updateFilterValue(filterName, filterValue) {
    const { updateFilterValue, filters, partyId, isModalOpen } = this.props;
    updateFilterValue(partyId, filters, filterName, filterValue).then(() => {
      !isModalOpen && this.fetchResultsWithoutUsingAmenities();
    });
  }

  shouldSearchUnits = filters => (filters.unitName || '').length || (filters.propertyIds || []).length;

  shouldFetchResults = () => this.props.isInventoryListVisible && this.shouldSearchUnits(this.props.filters);

  fetchResultsWithoutUsingAmenities() {
    if (this.shouldFetchResults()) {
      this.props.fetchResults({ ...this.props.filters, inventoryAmenities: [], partyId: this.props.partyId });
    }
  }

  handleMoveInDateChange = ({ value = {} }) => {
    const { from, to } = value;
    const dates = {
      min: from ? from.toJSON() : null,
      max: to ? to.toJSON() : null,
    };
    this.updateFilterValue('moveInDate', dates);
  };

  handleMarketRentRangeChange = range => this.updateFilterValue('marketRent', range);

  handleNumBedroomsTap = ({ ids }) => setTimeout(() => this.updateFilterValue('numBedrooms', ids), 100);

  handleNumberOfUnitsChange = ({ value }) => this.setState({ numberOfUnits: value });

  handleNumberOfUnitsBlur = () => {
    const { onSubmitNumberOfUnits } = this.props;
    const numberOfUnits = this.state.numberOfUnits;
    numberOfUnits && onSubmitNumberOfUnits && onSubmitNumberOfUnits({ partyId: this.props.partyId, numberOfUnits });
  };

  handleHigherAmenitiesChange = amenities => {
    this.updateFilterValue('amenities', amenities);
  };

  handleFloorChange = ({ ids }) => this.updateFilterValue('floor', ids);

  shouldShowRangeSlider = (marketRentRange, marketRent) => !!marketRentRange && marketRentRange.isValid && !!marketRent;

  renderCommonFilters({ marketRentRange, filters, timezone, isCorporateParty, properties } = this.props) {
    const { moveInDate = {} } = filters;
    const dates = {
      from: moveInDate.min ? toMoment(moveInDate.min, { timezone }) : undefined,
      to: moveInDate.max ? toMoment(moveInDate.max, { timezone }) : undefined,
    };

    const floors = getFloorsForProperties(properties);

    const amenitiesForSelectedProperties = getAmenitiesForProperties(properties);

    const rentPriceRange = this.shouldShowRangeSlider(marketRentRange, filters.marketRent)
      ? {
          min: floorAmountToClosestMultiple(marketRentRange.min),
          max: ceilAmountToClosestMultiple(marketRentRange.max),
        }
      : null;

    return (
      <AutoSize>
        {({ width, breakpoint }) => {
          const columns = Math.floor(width / 200);
          return (
            <div className={cf('unit-preferences', breakpoint)}>
              <ButtonBar
                label={t('LABEL_BEDROOMS')}
                items={this.numBedrooms}
                elementClassName={cf('bar-item')}
                selectedValue={filters.numBedrooms}
                multiple
                onChange={this.handleNumBedroomsTap}
              />
              <DateRange
                tz={timezone}
                label={t('LABEL_DATE')}
                lblFrom={t('FROM_DATE')}
                lblTo={t('TO_DATE')}
                value={dates}
                onChange={this.handleMoveInDateChange}
              />
              {!!rentPriceRange && (
                <RangeSlider
                  label={t('LABEL_PRICE')}
                  connect={true}
                  step={250}
                  formatValues={({ min, max }) => {
                    const maxAmountLabel =
                      max >= PRICE_FILTER_MAX ? (
                        <span>
                          <Money TextComponent={T.SubHeader} amount={PRICE_FILTER_MAX} noDecimals />+
                        </span>
                      ) : (
                        <Money TextComponent={T.SubHeader} noDecimals amount={max} data-id="maxPriceRangeText" />
                      );

                    return (
                      <span>
                        <Money TextComponent={T.SubHeader} amount={min} noDecimals /> - {maxAmountLabel}
                      </span>
                    );
                  }}
                  val={filters.marketRent}
                  normalizeRange
                  range={rentPriceRange}
                  onChange={this.handleMarketRentRangeChange}
                />
              )}
              {isCorporateParty && (
                <div className={cf('number-of-units')}>
                  <NumberOfUnits
                    numberOfUnits={this.state.numberOfUnits}
                    onChange={this.handleNumberOfUnitsChange}
                    onBlur={this.handleNumberOfUnitsBlur}
                    id="numberOfUnitsQuestion"
                  />
                </div>
              )}
              {!!amenitiesForSelectedProperties.length && (
                <SelectionGroup
                  label={t('LABEL_AMENITIES')}
                  items={amenitiesForSelectedProperties}
                  multiple
                  columns={columns}
                  selectedValue={(filters.amenities || {}).ids}
                  onChange={this.handleHigherAmenitiesChange}
                />
              )}
              {!!floors.length && (
                <SelectionGroup
                  label={t('LABEL_FLOOR')}
                  items={formatFloorLevels(floors)}
                  multiple
                  columns={columns}
                  selectedValue={filters.floor}
                  onChange={this.handleFloorChange}
                />
              )}
            </div>
          );
        }}
      </AutoSize>
    );
  }

  render() {
    return <div className={cf('mainContent')}>{this.renderCommonFilters()}</div>;
  }
}
