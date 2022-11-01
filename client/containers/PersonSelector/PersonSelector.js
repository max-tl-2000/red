/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { infoToDisplayOnPerson } from 'helpers/infoToDisplayOnPerson';

import { Dropdown, RedList, Typography } from 'components';
import { cf } from './PersonSelector.scss';

const { Text } = Typography;

class PersonSelector extends React.Component {
  static propTypes = {
    placeholder: PropTypes.string,
    handleChange: PropTypes.func,
    selectedValue: PropTypes.array,
    items: PropTypes.array,
    showListOnFocus: PropTypes.bool,
  };

  renderGroupItem({ item }) {
    return <Text bold>{item.originalItem.displayName}</Text>;
  }

  renderItem({ item }) {
    const mainTextStyle = { bold: false };
    mainTextStyle.bold = true;
    return (
      <RedList.ListItem rowStyle="mixed">
        <RedList.MainSection>
          <div className={cf('dropdown-wrapper-item')}>
            <Text className={cf('dropdown-item')} inline>
              {infoToDisplayOnPerson(item.originalItem)}
            </Text>
          </div>
        </RedList.MainSection>
      </RedList.ListItem>
    );
  }

  render() {
    const { placeholder, handleChange, selectedValue, items, meta, className, source, onNoMoreItemsToSelect, showListOnFocus } = this.props;

    return (
      <Dropdown
        placeholder={placeholder}
        autocomplete
        multiple
        wide
        onNoMoreItemsToSelect={onNoMoreItemsToSelect}
        overlayClassName={cf('person-overlay')}
        source={source}
        textField="displayName"
        valueField="id"
        renderItem={this.renderItem}
        renderGroupItem={this.renderGroupItem}
        onChange={handleChange}
        selectedValue={selectedValue}
        meta={meta}
        items={items}
        className={className}
        showListOnFocus={showListOnFocus}
      />
    );
  }
}

export default PersonSelector;
