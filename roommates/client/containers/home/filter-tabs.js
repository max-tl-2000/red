/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FilterToolbar } from 'components';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import { NotAllowedLayer } from '../../components/not-allowed-layer';
import { cf } from './filter-tabs.scss';
import { groupFilterTypes } from '../../../common/enums/filter-constants';

// TODO: Make filtering logic, in this case returns all
const filterRoommates = (roommates, ids) => roommates; // eslint-disable-line

const getFilteringItems = () => [
  {
    id: groupFilterTypes.ALL,
    text: t('FILTER_ALL_ROOMMATES'),
  },
  {
    id: groupFilterTypes.CONTACTED,
    text: t('FILTER_CONTACTED_ROOMMATES'),
  },
  /*
   * The below filter option will be available until pilot 2
   * { id: 3,
   *    text: t('FILTER_FAVORITED_ROOMMATES'),
   * }
   */
];

@inject('auth', 'home')
@observer
export class FilterTabs extends Component { // eslint-disable-line
  constructor(props, context) {
    super(props, context);
    this.state = {
      selectedItem: groupFilterTypes.ALL,
      items: getFilteringItems(),
    };
  }

  buildFilterObject = selectedFilter => {
    const {
      home: { roommatesFilter },
      home,
    } = this.props;

    if (selectedFilter === groupFilterTypes.CONTACTED) {
      home.updateFilterState({ selectedGroupFilter: selectedFilter });
      return {
        isActive: true,
        contacted: true,
        selectedGroupFilter: selectedFilter,
      };
    }

    return {
      moveInDateFrom: roommatesFilter.moveInDateFrom,
      moveInDateTo: roommatesFilter.moveInDateTo,
      preferLiveWith: roommatesFilter.preferLiveWith,
      isActive: roommatesFilter.isActive,
      gender: roommatesFilter.gender,
      contacted: undefined,
      selectedGroupFilter: selectedFilter,
    };
  };

  filterRoommates = async ids => {
    const selectedItem = ids[0]; // TODO: Use other property of the filter component instead of the array
    const {
      home,
      auth: { authInfo },
    } = this.props;

    await home.fetchRoommates({
      userId: authInfo.user.id,
      filter: this.buildFilterObject(selectedItem),
      replaceFilterState: !(selectedItem === groupFilterTypes.CONTACTED),
    });
    this.setState({ selectedItem });
  };

  render() {
    const { selectedItem, items } = this.state;
    return (
      <div className={cf('filter-tabs')}>
        {!this.props.auth.isAuthenticated && <NotAllowedLayer />}
        <FilterToolbar items={items} hideSearch selectedItem={[selectedItem]} onSelectionChange={({ ids }) => this.filterRoommates(ids)} />
      </div>
    );
  }
}
