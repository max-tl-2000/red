/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import Scrollable from 'components/Scrollable/Scrollable';
import * as L from 'components/List/RedList';
import * as T from 'components/Typography/Typography';
import TextBox from 'components/TextBox/TextBox';
import debounce from 'debouncy';
import scrollIntoView from 'helpers/scrollIntoView';

import { observable, action, reaction } from 'mobx';
import { observer, Observer } from 'mobx-react';
import { t } from 'i18next';
import { cf, g } from './FilterableList.scss';
import FilterableModel from './FilterableModel';

@observer
export default class FilterableList extends Component {
  @observable
  query;

  @observable
  selectedIndex = -1;

  constructor(props) {
    super(props);

    const { items, filterFn, selectedIds } = props;

    const model = (this.model = new FilterableModel({
      items,
      filterFn,
    }));

    model.setSelectedIds(selectedIds);

    reaction(
      () => this.selectedIndex,
      () => this.scrollFocusedElementIntoViewport(this.selectedIndex),
    );
    reaction(
      () => model.filteredElements,
      () => this.refreshScrollable(),
    );

    this.model = model;
  }

  focus() {
    if (this.filterRef) {
      this.filterRef.focus();
    }
  }

  @action
  componentWillReceiveProps(nextProps) {
    const { model, props } = this;

    if (nextProps.items !== props.items) {
      model.setItems(nextProps.items);
    }

    if (nextProps.filterFn !== props.filterFn) {
      model.setFilterFn(nextProps.filterFn);
    }

    if (nextProps.selectedIds !== props.selectedIds) {
      if (nextProps.selectedIds !== model.selected.ids) {
        console.log('performing the change');
        model.setSelectedIds(nextProps.selectedIds);
      }
    }
  }

  refreshScrollable = debounce(() => {
    this.scrollableRef && this.scrollableRef.updateScrollProps();
  }, 100);

  scrollFocusedElementIntoViewport = () => {
    if (this.selectedIndex > -1 && this.listRef) {
      const node = findDOMNode(this.listRef);
      const ele = node.querySelector(`[data-idx="${this.selectedIndex}"]`);
      scrollIntoView(ele);
    }
  };

  @action
  handleQueryChange = ({ value }) => {
    this.query = value;
    this.performSearch();
    this.selectedIndex = -1;
  };

  handleKeyDown = e => {
    const isArrowDown = e.key === 'ArrowDown';
    const isArrowUp = e.key === 'ArrowUp';

    if (isArrowDown || isArrowUp) e.preventDefault();

    if (isArrowUp) {
      this.moveToPrevIndex();
    }
    if (isArrowDown) {
      this.moveToNextIndex();
    }
  };

  handleKeyPress = e => {
    if (e.key === 'Enter') {
      const { model, selectedIndex } = this;
      const item = model.filteredElements[selectedIndex];

      if (item) {
        this.selectItem(item);
      }
    }
  };

  @action
  moveToPrevIndex() {
    if (this.selectedIndex >= 0) {
      this.selectedIndex--;
    }
  }

  @action
  moveToNextIndex() {
    const { model } = this;

    if (this.selectedIndex < model.filteredElements.length - 1) {
      this.selectedIndex++;
    }
  }

  performSearch = debounce(() => {
    const { model } = this;
    model.setQuery(this.query);
  }, 300);

  @action
  selectItem = item => {
    const { model, props } = this;
    const { onItemSelect, onChange } = props;
    const args = { model };

    onItemSelect && onItemSelect(item, args);

    if (args.cancel) return;

    const hasChanged = model.select(item);

    if (hasChanged) {
      onChange && onChange(model.selected);
    }
  };

  renderItem = (item, args) => {
    const { renderItem } = this.props;

    if (renderItem) {
      return renderItem(item, args);
    }

    return (
      <L.ListItem focused={args.focused} selected={args.selected}>
        <L.MainSection>
          <T.Text>{item.text}</T.Text>
        </L.MainSection>
      </L.ListItem>
    );
  };

  renderNoItems = () => {
    const { noItemsText = t('NO_ITEMS_TO_SELECT'), noItemsTemplate } = this.props;

    if (noItemsTemplate) {
      return noItemsTemplate();
    }

    return (
      <L.ListItem>
        <L.MainSection>
          <T.Text>{noItemsText}</T.Text>
        </L.MainSection>
      </L.ListItem>
    );
  };

  @action
  focusElementByIndex = idx => {
    this.selectedIndex = idx;
  };

  componentDidMount() {
    const node = findDOMNode(this.listRef);
    const ele = node.querySelector('[data-item-selected="true"]');

    if (!ele) return;

    const idx = parseInt(ele.getAttribute('data-idx'), 10);

    this.focusElementByIndex(idx);
  }

  renderNoMatches = () => {
    const { noMatchesText = t('NO_MATCHES_FOUND'), noMatchesTemplate } = this.props;

    if (noMatchesTemplate) {
      return noMatchesTemplate();
    }

    return (
      <L.ListItem>
        <L.MainSection>
          <T.Text>{noMatchesText}</T.Text>
        </L.MainSection>
      </L.ListItem>
    );
  };

  storeScrollableRef = ref => (this.scrollableRef = ref);

  storeListRef = ref => (this.listRef = ref);

  storeFilterRef = ref => (this.filterRef = ref);

  render() {
    const { model, props } = this;
    const { className, listClassName, id: cId, listHeight = 300, wide } = props;

    return (
      <div className={cf('filterableList', { wide }, g(className))} id={cId}>
        <Observer>
          {() => (
            <div className={cf('filter')}>
              <TextBox
                iconAffordance="magnify"
                wide
                ref={this.storeFilterRef}
                onKeyPress={this.handleKeyPress}
                onKeyDown={this.handleKeyDown}
                value={this.query}
                underline={false}
                onChange={this.handleQueryChange}
              />
            </div>
          )}
        </Observer>
        <Scrollable className={listClassName} height={listHeight} ref={this.storeScrollableRef}>
          <Observer>
            {() => (
              <L.List onKeyDown={this.handleKeyDown} onKeyPress={this.handleKeyPress} tabIndex={0} ref={this.storeListRef}>
                {model.items.length === 0 && this.renderNoItems()}
                {model.items.length > 0 && model.filteredElements.length === 0 && this.renderNoMatches()}
                {model.filteredElements.map((item, idx) => {
                  const { id } = model.getIdAndText(item);
                  const disabled = model.itemIsDisabled(item);
                  const selectItem = () => !disabled && this.selectItem(item);
                  const selected = model.itemIsSelected(item);

                  return (
                    <div data-idx={idx} key={id} data-item-selected={selected} onClick={selectItem}>
                      {this.renderItem(item, { focused: idx === this.selectedIndex, selected })}
                    </div>
                  );
                })}
              </L.List>
            )}
          </Observer>
        </Scrollable>
      </div>
    );
  }
}
