/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import PreloaderBlock from 'components/PreloaderBlock/PreloaderBlock';

import { GeminiScrollbar, Typography as T } from 'components';
import PersonListCard from './PersonListCard';
import { cf } from './PersonList.scss';

export default class PersonList extends Component {
  static propTypes = {
    persons: PropTypes.array,
    searchQuery: PropTypes.object,
    onPersonSelected: PropTypes.func,
  };

  handlePersonSelected = person => {
    const { onPersonSelected } = this.props;
    onPersonSelected && onPersonSelected(person);
  };

  render = () => {
    const { persons, searchQuery, loading } = this.props;

    if (loading) {
      return (
        <div data-c="person-list" className={cf('personList')}>
          <PreloaderBlock />
        </div>
      );
    }

    const personDivs = (persons || []).map(p => (
      <PersonListCard key={p.id} person={p} searchQuery={searchQuery} onPersonSelected={this.handlePersonSelected} />
    ));

    const hasSearchQueryValue = !searchQuery.empty;

    let labelText = t('POSSIBLE_MATCHES_LABEL');

    if (personDivs.length === 0 && hasSearchQueryValue) {
      labelText = t('NO_POSSIBLE_MATCHES_LABEL');
    }

    return (
      <div data-c="person-list" className={cf('personList')}>
        {hasSearchQueryValue && (
          <T.Caption className={cf('listTitle')} secondary>
            {labelText}
          </T.Caption>
        )}
        <GeminiScrollbar className={cf('scrollable-content')}>{personDivs}</GeminiScrollbar>
      </div>
    );
  };
}
