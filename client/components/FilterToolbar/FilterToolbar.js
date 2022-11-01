/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import Toolbar from '../Toolbar/Toolbar';
import Icon from '../Icon/Icon';
import IconButton from '../IconButton/IconButton';
import ToolbarItem from '../Toolbar/ToolbarItem';
import ToolbarDivider from '../Toolbar/ToolbarDivider';
import SelectionGroup from '../SelectionGroup/SelectionGroup';
import TextBox from '../TextBox/TextBox';
import { cf, g } from './FilterToolbar.scss';
import ButtonLabel from '../Typography/ButtonLabel';

export default class FilterToolbar extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      mode: props.hideSearch ? 'filters' : 'text', // or filters
    };
  }

  static propTypes = {
    items: PropTypes.array,
    textPlaceholder: PropTypes.string,
    multiple: PropTypes.bool,
    textIconName: PropTypes.string,
    filterIconName: PropTypes.string,
    selectedItem: PropTypes.array,
    onSelectionChange: PropTypes.func,
    onTextChange: PropTypes.func,
    className: PropTypes.string,
    id: PropTypes.string,
    hideSearch: PropTypes.bool,
    hideFilter: PropTypes.bool,
  };

  static defaultProps = {
    multiple: false,
    textIconName: 'magnify',
    filterIconName: 'filter-variant',
  };

  handleTextClick = () => {
    this.setState({ mode: 'text' });
    this.refs.txt.focus();
    this.props.onModeChange && this.props.onModeChange('text');
  };

  handleFilterClick = () => {
    this.setState({ mode: 'filters' });
    this.props.onModeChange && this.props.onModeChange('filters');
  };

  renderItemTemplate = ({ item, selected }) => (
    <div className={cf('tab', { selected })} data-id={item.id}>
      <ButtonLabel className={cf('button-label')}>{item.text}</ButtonLabel>
    </div>
  );

  render() {
    const {
      id,
      filterIconName,
      textIconName,
      className,
      textPlaceholder,
      items,
      textValue,
      selectedItem,
      multiple,
      onTextChange,
      onSelectionChange,
      hideSearch,
      hideFilter,
    } = this.props;

    const { mode } = this.state;

    return (
      <Toolbar id={id} data-component="filter-toolbar" className={cf('toolbar', g(className))}>
        <div className={cf('filters-block', { on: mode === 'filters' })}>
          {!hideFilter && (
            <ToolbarItem stretched>
              <SelectionGroup
                items={items}
                itemTemplate={this.renderItemTemplate}
                selectedValue={selectedItem}
                multiple={multiple}
                onChange={onSelectionChange}
              />
            </ToolbarItem>
          )}
          {!hideSearch && <ToolbarDivider />}
          {!hideSearch && (
            <ToolbarItem>
              <IconButton iconName={textIconName} onClick={this.handleTextClick} />
            </ToolbarItem>
          )}
        </div>
        {!hideSearch && (
          <div className={cf('text-block', { on: mode === 'text' })}>
            {!hideFilter && (
              <ToolbarItem>
                <IconButton iconName={filterIconName} onClick={this.handleFilterClick} />
              </ToolbarItem>
            )}
            {!hideFilter && <ToolbarDivider />}
            <ToolbarItem>
              <Icon name={textIconName} />
            </ToolbarItem>

            <ToolbarItem stretched>
              <TextBox
                placeholder={textPlaceholder}
                ref="txt"
                showClear
                value={textValue}
                onChange={onTextChange}
                className={cf('textbox')}
                underline={false}
                wide
              />
            </ToolbarItem>
          </div>
        )}
      </Toolbar>
    );
  }
}
