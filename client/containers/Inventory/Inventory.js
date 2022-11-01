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
import { fetchResults as fetchUnits, setNoUnitsToDisplay, openStepIndex } from 'redux/modules/inventoryStore';
import * as filterActions from 'redux/modules/unitsFilter';
import { updateParty } from 'redux/modules/partyStore';
import debounce from 'debouncy';
import { PreloaderBlock, FilterToolbar, Typography as T, Button } from 'components';
import isEqual from 'lodash/isEqual';
import { t } from 'i18next';
import { createSelector } from 'reselect';
import omit from 'lodash/omit';
import { DALTypes } from '../../../common/enums/DALTypes';
import { enhanceAdditionalTag, INVENTORY_STEPPER_SELECT_PROPERTY_STEP, INVENTORY_STEPPER_SELECT_AMENITIES_STEP } from '../../helpers/inventory';
import { ClientConstants } from '../../helpers/clientConstants';

import InventoryCard from './InventoryCard';
import InventoryFilters from './InventoryFilters';

import { cf, g } from './Inventory.scss';
import ModelUnits from './ModelUnits';
import injectProps from '../../helpers/injectProps';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';
import { toMoment } from '../../../common/helpers/moment-utils';
import PastScrollPoint from '../../../resources/pictographs/bottom-of-a-list.svg';
import SvgCheckList from '../../../resources/icons/check-list.svg';
import SvgMissingIcon from '../../../resources/icons/missing-icon.svg';
import SvgArrowTopRightCircle from '../../../resources/icons/arrow-top-right-circle.svg';
import SvgNoPreferencesSelected from '../../../resources/pictographs/no-preferences-selected.svg';
import SvgNoExactMatchesImage from '../../../resources/pictographs/no-exact-matches.svg';

// TODO: Move selectors to a custom file
const favoritesSelector = createSelector(
  state => state.dataStore.get('parties'),
  (state, props) => props.partyId,
  (parties, partyId) => {
    const metadata = (parties.get(partyId) || {}).metadata || {};
    return {
      partyMetadata: metadata,
      favoriteUnits: new Set(metadata.favoriteUnits || []),
    };
  },
);

const THRESHOLD_TO_DEBOUNCE_SCROLL_TO_TOP = 100;

const getUnitTaggedDate = (quote, appointment) => {
  // since this is just for comparing which date is after the other we don't need the timezone here
  const quoteTaggedAt = quote && quote.created_at ? toMoment(quote.created_at) : null;
  const appointmentCreatedDate = appointment && appointment.created_at ? toMoment(appointment.created_at) : null;
  return appointmentCreatedDate && appointmentCreatedDate > quoteTaggedAt ? appointmentCreatedDate : quoteTaggedAt;
};

const getTaggedUnits = createSelector(
  state => state.inventoryStore.searchResultsList,
  (state, props) => props.partyAppointments,
  state => state.quotes.quotes,
  (units, partyAppointments, quotes) =>
    units.reduce((acc, unit) => {
      const quote = quotes && quotes.find(q => q.inventory.id === unit.id);
      const appointment = partyAppointments && partyAppointments.find(a => a.metadata.inventories.some(inv => inv.id === unit.id));

      const taggedAt = getUnitTaggedDate(quote, appointment);

      if (taggedAt) acc.push({ id: unit.id, taggedAt });

      return acc;
    }, []),
);

const getComputedUnits = createSelector([state => state.inventoryStore.searchResultsList], units => {
  const result = units.reduce(
    (acc, inventory) => {
      if (inventory.state !== DALTypes.InventoryState.MODEL) {
        acc.inventories.push(inventory);
      } else {
        acc.models.push(inventory);
      }

      return acc;
    },
    { models: [], inventories: [] },
  );

  result.hasUnits = result.inventories.length > 0;
  result.hasModels = result.models.length > 0;

  result.hasData = result.hasUnits || result.hasModels;
  return result;
});

@connect(
  (state, props) => ({
    units: state.inventoryStore.searchResultsList,
    filters: state.unitsFilter.filters,
    loading: state.inventoryStore.searchingUnits,
    ...favoritesSelector(state, props),
    computedUnits: getComputedUnits(state),
    taggedUnits: getTaggedUnits(state, props),
    quotes: state.quotes.quotes,
    timezone: getPartyTimezone(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchUnits,
        openStepIndex,
        updateParty,
        setNoUnitsToDisplay,
        ...filterActions,
      },
      dispatch,
    ),
)
export default class Inventory extends Component {
  static propTypes = {
    units: PropTypes.array,
    filters: PropTypes.object,
    loading: PropTypes.bool,
    partyId: PropTypes.string,
    favoriteUnits: PropTypes.instanceOf(Set),
    partyMetadata: PropTypes.object,
    onQuoteClick: PropTypes.func,
    layout: PropTypes.string,
    fetchUnits: PropTypes.func,
    pushFilters: PropTypes.func,
    taggedUnits: PropTypes.array,
    setNoUnitsToDisplay: PropTypes.func,
  };

  filterTabs = [
    { id: 'allUnits', text: t('ALL_UNITS') },
    { id: 'favorites', text: t('PREFERRED') },
  ];

  constructor(props) {
    super(props);
    this.state = {
      selectedFilter: this.filterTabs[0].id,
      filterText: '',
      filterMode: 'text',
      displayAllModelUnits: false,
    };
  }

  searchUnits = filter => {
    // spread meant to copy filters other than unitName and favoriteUnits
    // which will be overwritten with new values
    const {
      unitName, // eslint-disable-line no-unused-vars
      favoriteUnits, // eslint-disable-line no-unused-vars
      ...otherFilters
    } = this.props.filters;

    const newFilters = {
      ...otherFilters,
      ...filter,
      partyId: this.props.partyId,
    };

    this.props.pushFilters(this.props.partyId, omit(newFilters, ['taggedUnits']));
    this.props.fetchUnits({
      ...newFilters,
      amenities: [],
    });
  };

  updateSearchOnFavoritesChange = debounce(
    (currentFavorites, nextFavorites) => {
      if (!nextFavorites) return;

      const { filterMode, selectedFilter } = this.state;
      const isFavoritesSelected = filterMode === 'filters' && selectedFilter === 'favorites';
      if (!isFavoritesSelected) return;

      const favoriteUnitsChanged = !isEqual(currentFavorites, nextFavorites);
      if (!favoriteUnitsChanged) return;

      this.searchUnits({
        favoriteUnits: nextFavorites,
        taggedUnits: this.props.taggedUnits,
      });
    },
    3000,
    this,
  );

  componentWillReceiveProps(nextProps) {
    this.updateSearchOnFavoritesChange(this.props.favoriteUnits, nextProps.favoriteUnits);
    this.setState({ displayAllModelUnits: false });
  }

  scrollToTop = debounce(() => {
    const { scrollWrapperRef } = this;
    if (!scrollWrapperRef) return;

    scrollWrapperRef.scrollTop = 0;
  }, THRESHOLD_TO_DEBOUNCE_SCROLL_TO_TOP);

  componentDidUpdate(prevProps) {
    if (prevProps.units !== this.props.units) {
      this.scrollToTop();
    }
  }

  toggleModelUnits = () => this.setState({ displayAllModelUnits: !this.state.displayAllModelUnits });

  getQueryFilterFromSelectedTab = selectedFilter =>
    selectedFilter === 'favorites'
      ? {
          favoriteUnits: [...this.props.favoriteUnits],
          taggedUnits: this.props.taggedUnits,
        }
      : {};

  getQueryFilterFromText = filterText => (filterText ? { unitName: filterText } : {});

  updateFilterMode = filterMode => {
    this.setState({ filterMode });
    const filter = filterMode === 'text' ? this.getQueryFilterFromText(this.state.filterText) : this.getQueryFilterFromSelectedTab(this.state.selectedFilter);

    this.searchUnits(filter);
  };

  updateSelectedFilter = selectedFilter => {
    this.setState({ selectedFilter });
    const filter = this.getQueryFilterFromSelectedTab(selectedFilter);

    this.searchUnits(filter);
  };

  updateFilterText = debounce(
    filterText => {
      this.setState({ filterText });
      const filter = this.getQueryFilterFromText(filterText);
      this.searchUnits(filter);
    },
    ClientConstants.SEARCH_DEBOUNCE_INTERVAL,
    this,
  );

  handleFavoriteUnitChanged = inventoryId => {
    const { favoriteUnits, partyMetadata, partyId } = this.props;

    const nextFavorites = favoriteUnits.has(inventoryId) ? [...favoriteUnits].filter(id => id !== inventoryId) : [...favoriteUnits, inventoryId];

    this.props.updateParty({
      id: partyId,
      metadata: {
        ...partyMetadata,
        favoriteUnits: nextFavorites,
      },
    });
  };

  renderModelUnits = (models, hasMoreThanTwoModels) => {
    const { partyId, timezone } = this.props;
    const { displayAllModelUnits } = this.state;

    return (
      <ModelUnits
        models={models}
        partyId={partyId}
        timezone={timezone}
        displayAllModelUnits={this.toggleModelUnits}
        collapsed={displayAllModelUnits}
        hasMoreThanTwoModels={hasMoreThanTwoModels}
      />
    );
  };

  renderNoPreferencesSelected = () => (
    <div className={cf('noPreferencesSelected')}>
      <SvgCheckList />
      <T.SubHeader> {t('NO_PROPERTY_SELECTED')} </T.SubHeader>
      <Button
        id="selectPropertyBtn"
        type="flat"
        label={t('SELECT_PROPERTY')}
        onClick={() => this.props.openStepIndex(INVENTORY_STEPPER_SELECT_PROPERTY_STEP)}
      />
      <div>
        <T.Text secondary> {t('FIND_UNIT_ABOVE')} </T.Text>
        <SvgArrowTopRightCircle />
      </div>
      <SvgNoPreferencesSelected />
    </div>
  );

  renderNoExactMatches = searchUnitText => {
    const headerText = searchUnitText ? 'NO_SEARCH_UNITS_FOUND' : 'NO_EXACT_MATCHES_FOUND';
    const subHeaderText = searchUnitText ? 'TRY_DIFFERENT_SEARCH_STRING' : 'DESELECT_PREFERENCES';

    return (
      <div className={cf('noExactMatches')}>
        <SvgMissingIcon />
        <T.SubHeader> {t(headerText)} </T.SubHeader>
        <T.Text secondary> {t(subHeaderText)} </T.Text>
        {!searchUnitText && (
          <Button
            id="updatePreferencesBtn"
            type="flat"
            label={t('UPDATE_PREFERENCES')}
            onClick={() => this.props.openStepIndex(INVENTORY_STEPPER_SELECT_AMENITIES_STEP)}
          />
        )}
        <SvgNoExactMatchesImage />
      </div>
    );
  };

  renderNoResult = filters => {
    const filteredPropertiesExist = !!(filters.propertyIds || []).length;
    return filteredPropertiesExist ? this.renderNoExactMatches(filters.unitName) : this.renderNoPreferencesSelected();
  };

  storeScrollWraper = ref => {
    this.scrollWrapperRef = ref;
  };

  @injectProps
  render({ computedUnits, className, loading, partyId, layout, favoriteUnits }) {
    const { selectedFilter, filterText, displayAllModelUnits } = this.state;
    const { hasUnits, hasModels, models } = computedUnits;
    const hasMoreThanTwoModels = models && models.length > 2;
    const defaultModels = hasMoreThanTwoModels ? [models[0], models[1]] : models;
    let { inventories: units } = computedUnits;
    const { partyAppointments, quotes, timezone, properties, filters } = this.props;
    units = enhanceAdditionalTag(units, partyAppointments, quotes);
    const modelsToRender = displayAllModelUnits ? models : defaultModels;

    const renderedUnits = units.map(inventory => (
      <InventoryCard
        inventory={inventory}
        layout={layout}
        key={inventory.id}
        timezone={timezone}
        partyId={partyId}
        properties={properties}
        isFavorite={favoriteUnits.has(inventory.id)}
        onMarkAsFavoriteClick={this.handleFavoriteUnitChanged}
        onQuoteClick={this.props.onQuoteClick}
      />
    ));

    const hasResults = hasModels || hasUnits;
    const noResults = !loading && !hasResults;
    return (
      <div className={cf('inventoryContainer', g(className))}>
        <div ref={this.storeScrollWraper} className={cf('scrollWrapper')}>
          <div>
            {loading && <PreloaderBlock />}
            {!loading && !!(filters.propertyIds || []).length && <InventoryFilters filters={filters} timezone={timezone} />}
            {!loading && hasModels && this.renderModelUnits(modelsToRender, hasMoreThanTwoModels)}
            {!loading && hasUnits && <div>{renderedUnits}</div>}
            {!loading && hasResults && (
              <div className={cf('noMoreMatches')}>
                <PastScrollPoint />
              </div>
            )}
            {noResults && this.renderNoResult(filters)}
          </div>
        </div>
        <div className={cf('filterToolbarWrapper')}>
          <FilterToolbar
            items={this.filterTabs}
            id="inventoryFilterBar"
            textPlaceholder={t('FIND_UNIT')}
            textValue={filterText}
            selectedItem={[selectedFilter]}
            onModeChange={mode => this.updateFilterMode(mode)}
            onSelectionChange={({ ids }) => this.updateSelectedFilter(ids[0])}
            onTextChange={({ value }) => this.updateFilterText(value)}
          />
        </div>
      </div>
    );
  }
}
