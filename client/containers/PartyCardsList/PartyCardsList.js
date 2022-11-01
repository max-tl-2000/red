/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { PreloaderBlock } from 'components';
import { getPartyFilterSelector } from 'redux/selectors/userSelectors';
import InfiniteScroll from 'react-infinite-scroller';
import Immutable from 'immutable';

import { createSelector } from 'reselect';
import PartyCardsSection from './PartyCardsSection';

import { DATETIME_TODAY, DATETIME_TOMORROW, DATETIME_LATER } from './constants';

const PAGE_SIZE = 10;

const splitParties = data => {
  const total = parseInt(data.get('total'), 10);
  const today = parseInt(data.get('today'), 10);
  const tomorrow = parseInt(data.get('tomorrow'), 10);
  const parties = data
    .get('laneData')
    .sort((a, b) => parseInt(a.get('rowNumber'), 10) - parseInt(b.get('rowNumber'), 10))
    .map(p => p.toJS());

  return {
    noOfPartiesInToday: today,
    noOfPartiesInTomorrow: tomorrow,
    noOfPartiesInLater: total - today - tomorrow,
    parties,
  };
};

const makeGetSplitParties = () => createSelector((state, props) => state.dashboardStore.lanes.get(props.state), splitParties);

// create a memoized function for each PartyCardList instance
// see: https://github.com/reactjs/reselect#sharing-selectors-with-props-across-multiple-components
const makeMapStateToProps = () => {
  const getSplitParties = makeGetSplitParties();

  const mapStateToProps = (state, props) => ({
    loading: state.dashboardStore.loading,
    showOnlyToday: state.dashboardStore.showOnlyToday,
    columnPosition: state.dashboardStore.columnPosition,
    showTaskOwners: state.dashboardStore.dashboardSelection && state.dashboardStore.dashboardSelection.isTeam,
    partyFilter: getPartyFilterSelector(state),
    currentUser: state.auth.user || {},
    users: state.globalStore.get('users'),
    ...getSplitParties(state, props),
  });
  return mapStateToProps;
};

@connect(makeMapStateToProps)
export default class PartyCardsList extends PureComponent {
  // eslint-disable-line
  static propTypes = {
    state: PropTypes.string.isRequired,
    users: PropTypes.object,
    loading: PropTypes.bool,
    showOnlyToday: PropTypes.bool,
    parties: PropTypes.object.isRequired,
    showTaskOwners: PropTypes.bool,
    currentUser: PropTypes.object,
    partyFilter: PropTypes.object,
    tomorrowCollapsed: PropTypes.bool,
    laterCollapsed: PropTypes.bool,
    noOfPartiesInToday: PropTypes.number,
    noOfPartiesInTomorrow: PropTypes.number,
    noOfPartiesInLater: PropTypes.number,
  };

  defaultState = {
    pageNo: 1,
    hasMoreItems: false,
    todayList: new Immutable.List(),
    tomorrowList: new Immutable.List(),
    laterList: new Immutable.List(),
  };

  constructor(props) {
    super(props);
    this.state = { ...this.defaultState };
  }

  componentWillReceiveProps(nextProps) {
    let currentState = this.state;
    if (this.props.partyFilter !== nextProps.partyFilter || this.props.showOnlyToday !== nextProps.showOnlyToday) {
      // reset state if filter changed
      currentState = { ...this.defaultState };
      this.setState(currentState);
    }

    const newState = this.loadPage(currentState.pageNo, nextProps);
    this.updateState(newState);
  }

  loadPage = (pageNo, props) => {
    const { parties } = props;
    const offset = (pageNo - 1) * PAGE_SIZE;
    const end = offset + PAGE_SIZE;
    const page = parties.slice(0, end);
    const hasMoreItems = end < parties.size;

    const res = { newParties: page, hasMoreItems, pageNo };
    return res;
  };

  updateState = ({ newParties, hasMoreItems, pageNo }) => {
    const todayList = newParties.filter(p => [0, 1, 2, 3, 4].indexOf(p.rank) >= 0);
    const tomorrowList = newParties.filter(p => [5, 6].indexOf(p.rank) >= 0);
    const laterList = newParties.filter(p => p.rank === 7);

    this.setState({
      pageNo,
      hasMoreItems,
      todayList,
      tomorrowList,
      laterList,
    });
  };

  loadMore = pageNo => {
    if (pageNo === this.state.pageNo) return;

    const res = this.loadPage(pageNo, this.props);
    this.updateState(res);
  };

  render = () => {
    const {
      loading,
      users,
      tomorrowCollapsed,
      laterCollapsed,
      partyFilter,
      noOfPartiesInToday,
      noOfPartiesInTomorrow,
      noOfPartiesInLater,
      showTaskOwners,
      currentUser,
      laneHeight,
    } = this.props;

    const { todayList, tomorrowList, laterList, hasMoreItems } = this.state;

    if (loading) return <PreloaderBlock />;

    const scrollProps = {
      loadMore: this.loadMore,
      useWindow: false,
      initialLoad: false,
      hasMore: hasMoreItems,
      threshold: 200,
      pageStart: 1,
    };

    const parentStyle = {
      padding: '.5rem .825rem',
      overflow: 'auto',
      paddingBottom: '6.25rem',
      height: laneHeight,
    };

    const dataDeps = { showTaskOwners, currentUser };

    return (
      <div style={parentStyle}>
        <InfiniteScroll {...scrollProps}>
          <PartyCardsSection
            data-type="section-today"
            dateType={DATETIME_TODAY}
            parties={todayList}
            noOfPartiesInSection={noOfPartiesInToday}
            users={users}
            dataDeps={dataDeps}
            partyFilter={partyFilter}
          />
          <PartyCardsSection
            data-type="section-tomorrow"
            collapsed={tomorrowCollapsed}
            dateType={DATETIME_TOMORROW}
            parties={tomorrowList}
            noOfPartiesInSection={noOfPartiesInTomorrow}
            users={users}
            dataDeps={dataDeps}
            partyFilter={partyFilter}
          />
          <PartyCardsSection
            data-type="section-later"
            collapsed={laterCollapsed}
            dateType={DATETIME_LATER}
            parties={laterList}
            noOfPartiesInSection={noOfPartiesInLater}
            users={users}
            dataDeps={dataDeps}
            partyFilter={partyFilter}
          />
        </InfiniteScroll>
      </div>
    );
  };
}
