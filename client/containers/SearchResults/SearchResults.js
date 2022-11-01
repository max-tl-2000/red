/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import SearchResultCard from '../SearchResultCard/SearchResultCard';

import { cf } from './SearchResults.scss';
export default class SearchResults extends Component { // eslint-disable-line
  render() {
    const { results, query, onItemSelected } = this.props;
    const enhancedQuery = {
      name: [query],
      phones: { phones: [query] },
      emails: { emails: [query] },
    };

    const resultsSections = results.map(item => <SearchResultCard item={item} key={item.id} query={enhancedQuery} onClick={() => onItemSelected(item)} />);

    return <div className={cf('containerStyle')}>{resultsSections}</div>;
  }
}
