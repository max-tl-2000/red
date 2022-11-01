/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { t } from 'i18next';
import difference from 'lodash/difference';
import { loadLifestyles, loadCfgValues } from 'redux/modules/amenityStore';
import { updateFilterValue, pushFilters } from 'redux/modules/unitsFilter';
import { fetchResults, setNoUnitsToDisplay, closeStepIndex } from 'redux/modules/inventoryStore';
import { updateParty } from 'redux/modules/partyStore';
import { Stepper, Step, StepSummary, StepContent, Typography, GeminiScrollbar } from 'components';
import uniq from 'lodash/uniq';
import intersection from 'lodash/intersection';
import Money from 'components/Table/Money';
import { INVENTORY_STEPPER_COLLAPSED_INDEX, INITIAL_INVENTORY_STEPPER_COLLAPSED_INDEX } from '../../helpers/inventory';
import {
  formattedNumBedroomsForFilters,
  formatFloorLevels,
  getMoveInDateSummary,
  getAmenitiesForProperties,
  getFloorsForProperties,
  updateUnitsFilter,
} from '../../helpers/unitsUtils';
import { cf } from './InventoryStepper.scss';

import LifestyleSelector from '../../custom-components/LifestylePreference/LifestyleSelector';
import PropertiesSelector from '../../custom-components/Properties/PropertiesSelector';
import PropertySummary from '../../custom-components/Properties/PropertySummary';

import SimpleUnitsFilter from '../SimpleUnitsFilter/SimpleUnitsFilter';
import { PRICE_FILTER_MAX } from '../../helpers/priceRangeConstants';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';

const { Text, Caption } = Typography;

@connect(
  (state, props) => ({
    lifestylePreferences: state.amenityStore.lifestyles,
    lifestylesLoaded: state.amenityStore.lifestylesLoaded,
    filters: state.unitsFilter.filters,
    user: state.auth.user,
    marketRentRange: state.inventoryStore.marketRentRange,
    hidePropertyLifestyles: state.amenityStore.hidePropertyLifestyles,
    cfgValuesLoaded: state.amenityStore.cfgValuesLoaded,
    timezone: getPartyTimezone(state, props),
    openStepperIndex: state.inventoryStore.openStepperIndex,
    shouldApplyFilters: state.unitsFilter.shouldApplyFilters,
  }),
  dispatch =>
    bindActionCreators(
      {
        loadLifestyles,
        loadCfgValues,
        updateFilterValue,
        fetchResults,
        pushFilters,
        updateParty,
        closeStepIndex,
        setNoUnitsToDisplay,
      },
      dispatch,
    ),
)
export default class InventoryStepper extends Component {
  static propTypes = {
    partyId: PropTypes.string,
    lifestylePreferences: PropTypes.array,
    onInventoryStepChange: PropTypes.func.isRequired,
    properties: PropTypes.array,
    qualificationQuestions: PropTypes.object,
    isCorporateParty: PropTypes.bool,
    openStepperIndex: PropTypes.number,
    setNoUnitsToDisplay: PropTypes.func,
    isInventoryListVisible: PropTypes.bool,
    shouldApplyFilters: PropTypes.bool,
  };

  constructor(props, context) {
    super(props, context);

    const selectedStepperIndex = INITIAL_INVENTORY_STEPPER_COLLAPSED_INDEX;
    this.filterLoadedOnce = false;
    const { qualificationQuestions = {} } = props;

    this.state = {
      selectedStepperIndex,
      matchingLifestylePreferences: [],
      searchTerm: '',
      isSearching: false,
      stepperExpanded: false,
      propertiesMatchingInfoMap: new Map(),
      teamPropertiesIds: [],
      numberOfUnits: qualificationQuestions.numberOfUnits,
    };
  }

  componentWillMount() {
    if (!this.props.lifestylesLoaded) {
      this.props.loadLifestyles();
    }

    if (!this.props.cfgValuesLoaded) {
      this.props.loadCfgValues();
    }
  }

  arePropertiesSelected = (propertyIds = []) => propertyIds.length;

  componentWillReceiveProps(nextProps) {
    if (nextProps.filters.propertyIds !== this.props.filters.propertyIds || !this.filterLoadedOnce) {
      if (this.arePropertiesSelected(nextProps.filters.propertyIds)) {
        this.props.isInventoryListVisible && this.props.fetchResults({ ...nextProps.filters, inventoryAmenities: [], partyId: this.props.partyId });
      } else {
        this.props.setNoUnitsToDisplay();
      }

      if (!this.filterLoadedOnce) {
        // this is executed once, after the filters for this party are loaded
        const selectedStepperIndex = INITIAL_INVENTORY_STEPPER_COLLAPSED_INDEX;
        this.setState({
          selectedStepperIndex,
        });
      }

      this.filterLoadedOnce = true;
    }

    if (this.props.properties !== nextProps.properties || !this.state.teamPropertiesIds[0]) {
      const teamIds = nextProps.user.teams.map(team => team.id);
      const teamPropertiesIds = nextProps.properties.filter(p => p.teamIds.some(tId => teamIds.includes(tId))).map(p => p.id);
      this.setState({ teamPropertiesIds });
    }

    const { qualificationQuestions = {} } = nextProps;
    if (qualificationQuestions.numberOfUnits !== this.state.numberOfUnits) {
      this.setState({ numberOfUnits: qualificationQuestions.numberOfUnits });
    }

    if (this.props.openStepperIndex === INVENTORY_STEPPER_COLLAPSED_INDEX && nextProps.openStepperIndex !== INVENTORY_STEPPER_COLLAPSED_INDEX) {
      this.handleOpen({ selectedIndex: nextProps.openStepperIndex });
    }
  }

  updateFiltersForSelectedProperties(properties, filtersWithUpdatedProperties) {
    const { filters, partyId } = this.props;

    if (properties.ids.length < filters.propertyIds.length) {
      const floorForSelectedProperties = getFloorsForProperties(properties.items);
      const floorIdsForSelectedProperties = floorForSelectedProperties.map(f => f.id);
      const validFloors = intersection(filters.floor, floorIdsForSelectedProperties);
      const filtersWithUpdatedFloors = updateUnitsFilter(filtersWithUpdatedProperties, 'floor', validFloors);

      const amenitiesForSelectedProperties = getAmenitiesForProperties(properties.items);
      const amenityIdsForSelectedProperties = amenitiesForSelectedProperties.map(a => a.id);
      const validAmenityIds = intersection(filters.amenities.ids, amenityIdsForSelectedProperties);
      const validAmenities = amenitiesForSelectedProperties.filter(a => validAmenityIds.includes(a.id));
      const filtersWithUpdatedAmenities = updateUnitsFilter(filtersWithUpdatedFloors, 'amenities', { ids: validAmenityIds, items: validAmenities });

      return this.props.pushFilters(partyId, filtersWithUpdatedAmenities);
    }
    return this.props.pushFilters(partyId, filtersWithUpdatedProperties);
  }

  getUpdatedMapOfMatchingLifestyles(selectedLifestyles) {
    const { properties } = this.props;
    const propertiesMatchingInfoMap = new Map();

    properties.forEach(property => {
      let count = 0;
      selectedLifestyles.length && property.lifestyleDisplayNames.forEach(lifestyle => selectedLifestyles.includes(lifestyle) && count++);
      propertiesMatchingInfoMap.set(property.id, selectedLifestyles.length ? `${count}/${selectedLifestyles.length} ${t('PROPERTY_LIFESTYLES_MATCHES')}` : '');
    });

    return propertiesMatchingInfoMap;
  }

  handleLifestyleSelected = lifestyles => {
    const { partyId, filters } = this.props;
    this.setState({
      searchTerm: '',
      propertiesMatchingInfoMap: this.getUpdatedMapOfMatchingLifestyles(lifestyles.ids),
    });
    this.props.updateFilterValue(partyId, filters, 'lifestyles', lifestyles.ids);
  };

  filterByLocation = (property, searchTerm) => {
    const location = p => `${p.city}, ${p.state}`;
    return location(property).toLowerCase().includes(searchTerm);
  };

  filterByDisplayName = (property, searchTerm) => property.displayName.toLowerCase().includes(searchTerm);

  getSelectedProperties = selectedAndDisplayedProperties => {
    const { searchTerm } = this.state;
    const { filters, properties } = this.props;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const searchedPropertiesIds =
      properties.length &&
      properties
        .filter(property => this.filterByLocation(property, lowerCaseSearchTerm) || this.filterByDisplayName(property, lowerCaseSearchTerm))
        .map(p => p.id);
    const selectedAndUndisplayedPropertiesIds = difference(filters.propertyIds, searchedPropertiesIds);

    return uniq([...selectedAndUndisplayedPropertiesIds, ...selectedAndDisplayedProperties.ids]);
  };

  handlePropertySelected = properties => {
    const { isSearching } = this.state;
    const { filters } = this.props;

    let updatedSelection;
    if (isSearching) {
      updatedSelection = this.getSelectedProperties(properties);
    }

    const filtersWithUpdatedProperties = updateUnitsFilter(filters, 'propertyIds', updatedSelection || properties.ids);
    this.updateFiltersForSelectedProperties(properties, filtersWithUpdatedProperties);
  };

  handleToggle = () => {
    this.setState({
      stepperExpanded: !this.state.stepperExpanded,
    });
  };

  handleCollapse = () => {
    this.setState({
      stepperExpanded: false,
    });
  };

  handleOpen = ({ selectedIndex }) => {
    this.props.onInventoryStepChange(true);

    this.setState({
      selectedStepperIndex: selectedIndex,
    });
  };

  handleClose = () => {
    this.props.onInventoryStepChange(false);
    this.props.closeStepIndex();
    this.setState({
      selectedStepperIndex: INVENTORY_STEPPER_COLLAPSED_INDEX,
    });
  };

  handleStepChanged = nextState => {
    this.setState({ selectedStepperIndex: nextState.selectedIndex });
    this.props.closeStepIndex();
  };

  searchProperties = value => {
    this.setState({
      searchTerm: value || '',
      isSearching: !!value,
    });
  };

  handleOnPropertyHover = (id, hover) => {
    const property = this.props.properties.find(p => p.id === id);
    this.setState({
      matchingLifestylePreferences: hover ? property.lifestyleDisplayNames : [],
    });
  };

  handleSubmitNumberOfUnits = ({ partyId, numberOfUnits }) => {
    const { qualificationQuestions } = this.props;
    this.props.updateParty({ id: partyId, qualificationQuestions: { ...qualificationQuestions, numberOfUnits } });
  };

  renderPriceRangeMaxAmount = maxAmount => {
    const shouldShowPlusSymbol = maxAmount >= PRICE_FILTER_MAX;

    if (shouldShowPlusSymbol) {
      return (
        <span>
          <Money noDecimals amount={PRICE_FILTER_MAX} />
          <span>+</span>
        </span>
      );
    }

    return <Money noDecimals amount={maxAmount} />;
  };

  getPriceRangeSummary = () => {
    const { marketRent } = this.props.filters;
    return (
      <span>
        <Money noDecimals amount={marketRent.min} /> - {this.renderPriceRangeMaxAmount(marketRent.max)}
      </span>
    );
  };

  getFloorSummary = () => {
    const { floor } = this.props.filters;
    return formatFloorLevels(floor).join(', ');
  };

  render = () => {
    const {
      partyId,
      lifestylePreferences,
      properties,
      isCorporateParty,
      filters,
      marketRentRange,
      hidePropertyLifestyles,
      isInventoryListVisible,
    } = this.props;
    const {
      selectedStepperIndex,
      matchingLifestylePreferences,
      propertiesMatchingInfoMap,
      searchTerm,
      isSearching,
      stepperExpanded,
      teamPropertiesIds,
    } = this.state;

    const selectedPropertyIds = filters.propertyIds || [];
    const selectedLifestylePreferences = filters.lifestyles || [];

    const isDataSelected = selectedStepperIndex === 0 && (selectedLifestylePreferences.length || selectedPropertyIds.length);

    const showPropertiesSelector = properties.length > 1;
    const computedProperties = (properties || []).map(property => ({
      id: property.id,
      imageUrl: property.imageUrl,
      location: `${property.city}, ${property.state}`,
      name: property.displayName,
      matches: propertiesMatchingInfoMap.get(property.id),
      lifestyles: property.lifestyleDisplayNames,
      amenities: property.amenities,
      floors: property.floors,
    }));

    const selectedProperties = (computedProperties || []).filter(p => selectedPropertyIds.length && selectedPropertyIds.find(item => item === p.id));
    const amenitiesForSelectedProperties = getAmenitiesForProperties(selectedProperties);

    const selectedAndTeamPropertiesIds = uniq([...selectedPropertyIds, ...teamPropertiesIds]);
    const computedSelectedAndTeamProperties = computedProperties.filter(p => selectedAndTeamPropertiesIds.includes(p.id));

    const hasBedroomsFilter = !!(filters.numBedrooms || []).length;
    const hasMoveInFilter = !!(filters.moveInDate || {}).min || !!(filters.moveInDate || {}).max;
    const hasNumberOfUnits = isCorporateParty && !!this.state.numberOfUnits;
    const hasPriceRangeFilter =
      !!(filters.marketRent || {}).min &&
      !!(filters.marketRent || {}).max &&
      marketRentRange &&
      marketRentRange.isValid &&
      (filters.marketRent.min !== marketRentRange.min || filters.marketRent.max !== marketRentRange.max);
    const hasHighAmenitiesFilter = !!(filters.amenities && !!(filters.amenities.ids || []).length);
    const hasFloorFilter = !!(filters.floor || []).length;

    const showLifestylePreferences = !hidePropertyLifestyles;

    return (
      <div ref={s => (this.stepper = s)}>
        <Stepper
          selectedIndex={selectedStepperIndex}
          expanded={stepperExpanded}
          onCollapse={this.handleCollapse}
          onOpen={this.handleOpen}
          onClose={this.handleClose}
          onStepChange={this.handleStepChanged}
          lblNext={isDataSelected ? t('CONTINUE') : t('SKIP_THIS_STEP')}>
          <Step title={t(showLifestylePreferences ? 'LIFESTYLE_PROPERTIES_LABEL' : 'SELECT_PROPERTIES')} expandedClassName={cf('expanded')}>
            <StepSummary>
              {showLifestylePreferences && !selectedLifestylePreferences.length && !selectedPropertyIds.length && (
                <Caption secondary>{t('NO_LIFESTYLE_PROPERTIES_SELECTED')}</Caption>
              )}
              {showLifestylePreferences && !!selectedLifestylePreferences.length && (
                <div className={cf('lifestylesSummary')}>
                  <Caption secondary>{t('LIFESTYLES_LABEL')}</Caption>
                  {selectedLifestylePreferences.map(id => (
                    <Text key={id} className={cf('selectedLifestyle')}>
                      {id}
                    </Text>
                  ))}
                </div>
              )}
              {!!selectedPropertyIds.length && (
                <div className={cf('propertiesSummary')}>
                  <Caption secondary>{t('PROPERTIES_LABEL')}</Caption>
                  {selectedPropertyIds.map(id => {
                    const property = computedProperties.find(p => p.id === id);
                    return (
                      <PropertySummary
                        key={id}
                        property={property}
                        lifestylePreferences={lifestylePreferences}
                        selectedLifestylePreferences={selectedLifestylePreferences}
                        className={cf('selectedProperty')}
                      />
                    );
                  })}
                </div>
              )}
            </StepSummary>
            <StepContent>
              <div className={cf('container', showPropertiesSelector && showLifestylePreferences ? 'twoPanel' : '')}>
                {showLifestylePreferences && (
                  <GeminiScrollbar className={cf(showPropertiesSelector ? 'lifestyle' : '')}>
                    <LifestyleSelector
                      preferences={lifestylePreferences}
                      onSelectionChange={this.handleLifestyleSelected}
                      selectedPreferences={selectedLifestylePreferences}
                      matchingPreferences={matchingLifestylePreferences}
                    />
                  </GeminiScrollbar>
                )}
                {showPropertiesSelector && (
                  <GeminiScrollbar className={showLifestylePreferences && cf('properties')}>
                    <PropertiesSelector
                      properties={computedProperties}
                      numColsPreferred={showLifestylePreferences ? 3 : 5}
                      displayedProperties={computedSelectedAndTeamProperties}
                      selectedProperties={selectedPropertyIds}
                      showProperties={!!isDataSelected}
                      expanded={stepperExpanded}
                      onExpandToggle={this.handleToggle}
                      searchTerm={searchTerm}
                      isSearching={isSearching}
                      onSearch={this.searchProperties}
                      onSelectionChange={this.handlePropertySelected}
                      onPropertyHover={this.handleOnPropertyHover}
                    />
                  </GeminiScrollbar>
                )}
              </div>
            </StepContent>
          </Step>
          <Step title={t('UNIT_PREFERENCES_LABEL')} data-id="unitPreferencesStep">
            <StepSummary>
              {!hasBedroomsFilter && !hasMoveInFilter && !hasNumberOfUnits && !hasPriceRangeFilter && !hasHighAmenitiesFilter && !hasFloorFilter && (
                <Caption secondary>{t('NO_UNIT_PREFERENCES_SELECTED')}</Caption>
              )}
              {hasBedroomsFilter && (
                <div className={cf('unitsSummary')}>
                  <Caption secondary>{t('BEDROOMS_LABEL')}</Caption>
                  <Text id="numBedroomsText">{formattedNumBedroomsForFilters(filters.numBedrooms)}</Text>
                </div>
              )}
              {hasMoveInFilter && (
                <div className={cf('unitsSummary')}>
                  <Caption secondary>{t('MOVE_IN_DATE_RANGE_LABEL')}</Caption>
                  <Text id="moveInDatePreferenceText">{getMoveInDateSummary(this.props.filters.moveInDate, { timezone: this.props.timezone })}</Text>
                </div>
              )}
              {hasNumberOfUnits && (
                <div className={cf('unitsSummary')}>
                  <Caption secondary>{t('NUMBER_OF_UNITS')}</Caption>
                  <Text>{this.state.numberOfUnits}</Text>
                </div>
              )}
              {hasPriceRangeFilter && (
                <div className={cf('unitsSummary')}>
                  <Caption secondary>{t('PRICE_RANGE_LABEL')}</Caption>
                  <Text>{this.getPriceRangeSummary()}</Text>
                </div>
              )}
              {hasHighAmenitiesFilter && (
                <div className={cf('unitsSummary')}>
                  <Caption secondary>{t('AMENITIES_LABEL')}</Caption>
                  <Text>
                    {amenitiesForSelectedProperties
                      .filter(e => filters.amenities.ids.includes(e.id))
                      .map(e => e.text)
                      .join(', ')}
                  </Text>
                </div>
              )}
              {hasFloorFilter && (
                <div className={cf('unitsSummary')}>
                  <Caption secondary>{t('LABEL_FLOOR')}</Caption>
                  <Text>{this.getFloorSummary()}</Text>
                </div>
              )}
            </StepSummary>
            <StepContent>
              <SimpleUnitsFilter
                partyId={partyId}
                properties={selectedProperties}
                numberOfUnits={this.state.numberOfUnits}
                onSubmitNumberOfUnits={this.handleSubmitNumberOfUnits}
                isCorporateParty={isCorporateParty}
                isInventoryListVisible={isInventoryListVisible}
              />
            </StepContent>
          </Step>
        </Stepper>
      </div>
    );
  };
}
