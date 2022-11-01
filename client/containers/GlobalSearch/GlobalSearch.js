/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import AppBarBack from 'custom-components/AppBar/AppBarBack';
import GlobalSearchBox from 'custom-components/GlobalSearchBox/GlobalSearchBox';
import { AppBarMainSection, Scrollable, PreloaderBlock } from 'components';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as globalsearch from 'redux/modules/search';
import { t } from 'i18next';
import trim from 'helpers/trim';
import { observer, inject } from 'mobx-react';
import SearchResults from '../SearchResults/SearchResults';
import SearchHistory from '../SearchHistory/SearchHistory';
import NoHistoryResults from '../NoHistoryResults/NoHistoryResults';

import NoUnitResults from './NoUnitResults';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './GlobalSearch.scss';

@connect(
  state => ({
    query: state.search.query,
    loading: state.search.loading,
    suggestions: state.search.suggestions,
    globalSearchResults: state.search.globalSearchResults,
    searchHistory: state.search.history,
  }),
  dispatch =>
    bindActionCreators(
      {
        ...globalsearch,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class GlobalSearch extends React.Component {
  static propTypes = {
    performSearch: PropTypes.func,
    loadSuggestions: PropTypes.func,
    getUserSearchHistory: PropTypes.func,
  };

  componentWillMount() {
    const { getUserSearchHistory } = this.props;
    getUserSearchHistory();
  }

  componentDidMount() {
    this.searchBox.focus();
    this.searchBox.value = this.props.query;
  }

  handleSuggestionRequest = async ({ query }) => {
    if (!query) return [];
    const { loadSuggestions } = this.props;
    const filters = { hideClosedParties: true, hideArchivedParties: true, onlyOrphans: true, hideUnits: true, hidePersons: true, isAutoSuggest: true };
    await loadSuggestions({ query, filters });
    // globalSearchResults is populated by the redux container by the end of the promise
    // it is actually also returned, but it is better to use the
    // value from the props as it might had been transformed by the redux reducer
    return this.props.suggestions;
  };

  handleEnterPress = (e, { value }) => {
    if (!trim(value)) return;

    const { performSearch } = this.props;
    const filters = { includeSpam: true };
    performSearch && performSearch(value, filters);
  };

  handleOnClear = () => {
    const { clearResults } = this.props;
    clearResults && clearResults();
  };

  showItem = item => {
    const { leasingNavigator } = this.props;
    switch (item.type) { // eslint-disable-line
      case DALTypes.ItemType.unit:
        leasingNavigator.navigateToInventory(item.id);
        break;
      case DALTypes.ItemType.person:
        leasingNavigator.navigateToPerson(item.id);
        break;
      case DALTypes.ItemType.party:
        leasingNavigator.navigateToParty(item.id);
        break;
    }
  };

  selectASuggestion = selections => {
    if (selections.items.length === 0) {
      return;
    }
    const item = selections.items[0];
    if (item) {
      this.showItem(item);
    }
  };

  restoreSearch = value => {
    this.searchBox.value = value;
    const { performSearch } = this.props;
    const filters = { includeSpam: true };
    performSearch && performSearch(value, filters);
  };

  render() {
    const { globalSearchResults = [], query, searchHistory = [], loading } = this.props;
    const hasQuery = trim(query);
    const globalSearchResultsToDisplay =
      globalSearchResults && globalSearchResults.filter(sr => !sr.contactInfo || (sr.contactInfo && sr.contactInfo.some(ci => !ci.isSpam)));
    const hasResults = !!globalSearchResultsToDisplay.length;
    const displayHistory = !hasQuery && !hasResults && !!searchHistory.length;

    return (
      <div className={cf('globalSearch')}>
        <AppBarBack secondary>
          <AppBarMainSection className={cf('appBarMainSection')}>
            <GlobalSearchBox
              ref={ref => (this.searchBox = ref)}
              onSuggestionsRequest={this.handleSuggestionRequest}
              onEnterPress={this.handleEnterPress}
              onClear={this.handleOnClear}
              onChange={this.selectASuggestion}
            />
          </AppBarMainSection>
        </AppBarBack>
        <div className={cf('pageContent')}>
          <Scrollable>
            <div className={cf('containerStyle')}>
              {loading && <PreloaderBlock />}
              {!displayHistory && !hasQuery && !hasResults && <NoHistoryResults />}
              {displayHistory && <SearchHistory onClick={this.restoreSearch} className={cf('searchHistory')} searches={searchHistory} />}
              {hasResults && hasQuery && <SearchResults results={globalSearchResultsToDisplay} query={query} onItemSelected={this.showItem} />}
              {!loading && hasQuery && !hasResults && (
                <NoUnitResults
                  query={query}
                  displaySuggestions={!globalSearchResults.length}
                  noResultPrefixText={globalSearchResults.length ? `${t('CLOSE_PARTY_REASON_BLOCKED_CONTACT')} ` : `${t('NO_UNIVERSAL_SEARCH_FOUND_PRE')} "`}
                  noResultSuffixText={(!globalSearchResults.length && '"') || ''}
                  icon="magnify"
                />
              )}
            </div>
          </Scrollable>
        </div>
      </div>
    );
  }
}
