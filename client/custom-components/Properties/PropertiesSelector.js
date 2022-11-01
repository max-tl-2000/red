/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import injectProps from 'helpers/injectProps';

import debounce from 'debouncy';

import { t } from 'i18next';
import remove from 'lodash/remove';
import indexOf from 'lodash/indexOf';
import sortBy from 'lodash/sortBy';
import { getPropertyImage } from 'helpers/cloudinary';

import { Icon, IconButton, TextBox, FormattedMarkdown, TileSelectionGroup, Toolbar, ToolbarItem, ToolbarDivider } from 'components';
import { cf, g } from './PropertiesSelector.scss';

import PropertyCard from './PropertyCard';

export default class PropertiesSelector extends Component {
  static propTypes = {
    properties: PropTypes.array,
    selectedProperties: PropTypes.array,
    showProperties: PropTypes.bool,
    expanded: PropTypes.bool,
    onExpandToggle: PropTypes.func,
    searchTerm: PropTypes.string,
    isSearching: PropTypes.bool,
    onSearch: PropTypes.func,
    onSelectionChange: PropTypes.func,
    onPropertyHover: PropTypes.func,
    numColsPreferred: PropTypes.number,
  };

  static defaultProps = {
    numColsPreferred: 3,
  };

  constructor(props) {
    super(props);

    this._searchProperties = debounce(this.searchProperties, 400, this);
  }

  searchProperties = args => {
    const searchInput = args.value;
    const { onSearch } = this.props;
    onSearch && onSearch(searchInput);
  };

  clearSearchInput = () => this.searchProperties({ value: '' });

  handleOnPropertyHover = (id, hover) => {
    const { onPropertyHover } = this.props;
    onPropertyHover && onPropertyHover(id, hover);
  };

  renderPropertyGroup = (items, onSelectionChange, selectedProperties = []) => {
    const itemTemplate = ({
      item: {
        originalItem: { id, imageUrl, location, name, matches },
      },
      selected,
    }) => (
      <PropertyCard
        id={id}
        imageUrl={getPropertyImage(imageUrl, { height: 130 })}
        location={location}
        name={name}
        matches={matches}
        selected={selected}
        onPropertyHover={this.handleOnPropertyHover}
      />
    );
    const baseWidth = 132;
    const gutter = 12;

    return (
      <TileSelectionGroup
        items={items}
        baseWidth={baseWidth}
        gutter={gutter}
        numColsPreferred={this.props.numColsPreferred}
        multiple
        onChange={onSelectionChange}
        selectedValue={selectedProperties}
        itemTemplate={itemTemplate}
      />
    );
  };

  @injectProps
  renderResults({ properties, isSearching, searchTerm, selectedProperties, onSelectionChange, displayedProperties }) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const allItems = isSearching
      ? properties.filter(
          property => property.location.toLowerCase().includes(lowerCaseSearchTerm) || property.name.toLowerCase().includes(lowerCaseSearchTerm),
        )
      : sortBy(displayedProperties, ['matches']).reverse();

    if (!allItems.length) {
      return this.noResults();
    }

    const selectedItems = remove(allItems, property => indexOf(selectedProperties, property.id) !== -1);
    const orderedItems = [...selectedItems, ...allItems];

    return this.renderPropertyGroup(orderedItems, onSelectionChange, selectedProperties);
  }

  @injectProps
  noResults({ searchTerm, displayedProperties, onSelectionChange }) {
    return (
      <div>
        {searchTerm && (
          <div className={cf('results')}>
            <div className={cf('iconContainer')}>
              <Icon name={'magnify'} className={cf('icon')} />
            </div>
            <FormattedMarkdown className={cf(g('body textSecondary'), 'info')}>{`${t('NO_RESULTS_FOR')}**"${searchTerm}"**`}</FormattedMarkdown>
            <FormattedMarkdown className={cf(g('body textSecondary'), 'suggestions')}>{`${t('NO_RESULTS_SUGGESTIONS')}`}</FormattedMarkdown>
          </div>
        )}
        {!searchTerm && this.renderPropertyGroup(displayedProperties, onSelectionChange)}
      </div>
    );
  }

  @injectProps
  render({ showProperties, isSearching, searchTerm, expanded, onExpandToggle }) {
    return (
      <div className={cf('mainContent')}>
        <Toolbar>
          <ToolbarItem>
            <Icon name="magnify" className={cf('icon')} />
          </ToolbarItem>
          <ToolbarItem stretched>
            <TextBox
              ref="searchInput"
              className={cf('textbox')}
              placeholder={t('FIND_PROPERTY_PLACEHOLDER')}
              underline={false}
              value={searchTerm}
              onChange={this._searchProperties}
            />
          </ToolbarItem>
          {isSearching && (
            <ToolbarItem>
              <IconButton iconName="close" className={cf('icon')} onClick={this.clearSearchInput} />
            </ToolbarItem>
          )}
          <ToolbarDivider />
          <ToolbarItem>
            <IconButton iconName={expanded ? 'arrow-compress' : 'arrow-expand'} className={cf('icon')} onClick={onExpandToggle} />
          </ToolbarItem>
        </Toolbar>
        <div style={{ padding: '.7rem 0 0 0' }}>{showProperties || isSearching ? this.renderResults() : this.noResults()}</div>
      </div>
    );
  }
}
