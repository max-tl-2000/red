/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import ellipsis from 'helpers/ellipsis';
import debounce from 'debouncy';
import trim from 'helpers/trim';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { cf, g } from './SearchForm.scss';
import { _highlightMatches } from '../../helpers/highlightMatches';
import TextBox from '../../components/TextBox/TextBox';
import SelectionModel from '../../components/SelectionGroup/SelectionModel';
import FormattedMarkdown from '../../components/Markdown/FormattedMarkdown';
import Caption from '../../components/Typography/Caption';
import List from '../../components/List/List';
import ListItem from '../../components/List/ListItem';
import MainSection from '../../components/List/MainSection';
import GroupSection from '../../components/List/GroupSection';
import Scrollable from '../../components/Scrollable/Scrollable';

@observer
export default class SearchForm extends Component {
  static propTypes = {
    textField: PropTypes.string,
    valueField: PropTypes.string,
    multiple: PropTypes.bool,
    matchQuery: PropTypes.func,
    renderItem: PropTypes.func,
    renderGroupItem: PropTypes.func,
    highlightMatches: PropTypes.func,
    emptyResultsTemplate: PropTypes.func,
    noMoreItemsTemplate: PropTypes.func,
    suggestedItems: PropTypes.array,
  };

  constructor(props) {
    super(props);

    this.handleChange = debounce(this.handleChange, 50, this);

    const model = this.createModel(props);
    this.state = {
      model,
    };
  }

  createModel = props => {
    const { items = [], multiple, textField, valueField, matchQuery } = props;

    const model = new SelectionModel({
      items,
      multiple,
      textField,
      valueField,
      matchQuery,
    });

    model.onChange = this.handleChange;

    return model;
  };

  selection = () => {
    const { model } = this.state;

    if (model) {
      return model.selection;
    }

    return [];
  };

  componentWillReceiveProps(nextProps) {
    if ('items' in nextProps) {
      const { items } = nextProps;

      if (items !== this.props.items) {
        this.updateModel(nextProps);
      }
    }
  }

  updateModel(props) {
    const { items = [], multiple, textField, valueField, matchQuery } = props;

    if (this.state.model) {
      this.state.model.update({
        items,
        multiple,
        textField,
        valueField,
        matchQuery,
      });
    }
  }

  handleChange = () => {
    const { onChange } = this.props;
    onChange && onChange(this.selection());
  };

  handleQuery = ({ value }) => {
    const { onQueryChange } = this.props;
    onQueryChange && onQueryChange(value);
    this.state.model.setQuery(value);
  };

  _renderGroupItem = ({ item }) => <Caption>{ellipsis(item.text, 40)}</Caption>;

  _renderItem = ({ item, query, highlightMatches }) => {
    const text = highlightMatches(item.text, query);
    return (
      <ListItem>
        <MainSection className={cf('item-main-section')}>{text}</MainSection>
      </ListItem>
    );
  };

  renderOptions = (groups = {}) => {
    const { items = [], id = '' } = groups;
    const { model } = this.state || {};
    const { groupItemClassName, renderGroupItem, renderItem, highlightMatches } = this.props;

    const rGroupItem = renderGroupItem || this._renderGroupItem;
    const rItem = renderItem || this._renderItem;
    const highlightMatchesFn = highlightMatches || _highlightMatches;

    return items.reduce((acc, item, index) => {
      if (item.items) {
        const groupItem = rGroupItem({ item, index });

        acc.push(
          <GroupSection key={item.id} className={cf('group-section', g(groupItemClassName))}>
            {groupItem}
          </GroupSection>,
        );
        acc = acc.concat(this.renderOptions(item));
      } else {
        const itemId = `${id ? `${id}_` : ''}${item.id}`;
        const dataId = item.text ? `${item.text.replace(/\s/g, '')}_optionItem` : '';
        const listItem = rItem({
          item,
          query: model.query,
          highlightMatches: highlightMatchesFn,
        });
        acc.push(
          <div id={itemId} key={itemId} onClick={() => model.select(item)} data-id={dataId}>
            {listItem}
          </div>,
        );
      }
      return acc;
    }, []);
  };

  renderEmptyResults = () => {
    let { emptyResultsTemplate } = this.props;
    const { model } = this.state;

    if (!emptyResultsTemplate) {
      emptyResultsTemplate = query => <FormattedMarkdown className={cf('card-template')}>{t('NO_RESULTS', { query })}</FormattedMarkdown>;
    }

    return emptyResultsTemplate(model.query);
  };

  renderNoMoreResults = () => {
    let { noMoreItemsTemplate } = this.props;

    if (!noMoreItemsTemplate) {
      noMoreItemsTemplate = () => <FormattedMarkdown className={cf('card-template')}>{t('NO_MORE_ITEMS')}</FormattedMarkdown>;
    }

    return noMoreItemsTemplate();
  };

  renderList = () => {
    const { model } = this.state;

    const emptyQuery = trim(model.query) === '';
    if (model.items.length === 0 && !emptyQuery) {
      return this.renderEmptyResults();
    }

    const results = this.renderOptions(model);

    if (results.length === 0 && !emptyQuery) {
      return this.renderNoMoreResults();
    }

    return results;
  };

  isQueryEmpty = () => !this.state.model.query || this.state.model.query === '';

  renderSuggestions = () => {
    const { suggestedItems, multiple, textField, valueField, matchQuery } = this.props;

    // TODO: Check why this is needed?
    const suggestionsModel = new SelectionModel({
      items: suggestedItems,
      multiple,
      textField,
      valueField,
      matchQuery,
    });

    return this.renderOptions(suggestionsModel);
  };

  renderItems = () => {
    if (this.isQueryEmpty() && this.props.suggestedItems && this.props.suggestedItems.length) {
      return this.renderSuggestions();
    }
    return this.renderList();
  };

  render() {
    const { className, textboxClassName, listClassName, placeholder, formId = 'employeeSearchForm' } = this.props;

    return (
      <div data-component="search" id={formId} className={cf('search-wrapper', g(className))}>
        <div className={cf('search-box')}>
          <TextBox
            placeholder={placeholder}
            autoComplete="off"
            underline={false}
            iconAffordance="magnify"
            wideIcon
            className={textboxClassName}
            onChange={this.handleQuery}
          />
        </div>
        <Scrollable className={cf('results-wrapper')}>
          <List ref="list" className={cf(g(listClassName))} data-id={`${formId}List`}>
            {this.renderItems()}
          </List>
        </Scrollable>
      </div>
    );
  }
}
