/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import ellipsis from 'helpers/ellipsis';
import trim from 'helpers/trim';
import $ from 'jquery';
import scrollIntoView from 'helpers/scrollIntoView';
import debounce from 'debouncy';
import { observer } from 'mobx-react';
import { action, reaction } from 'mobx';
import contains from 'helpers/contains';
import { t } from 'i18next';
import { dataProps } from 'helpers/data-props';
import nullish from 'helpers/nullish';
import { toSentenceCase } from 'helpers/capitalize';
import isEqual from 'lodash/isEqual';
import { cf, g } from './Dropdown.scss';
import { _highlightMatches } from '../../helpers/highlightMatches';
import FlyOut from '../FlyOut/FlyOut';
import FlyOutOverlay from '../FlyOut/FlyOutOverlay';
import FlyOutActions from '../FlyOut/FlyOutActions';
import Button from '../Button/Button';
import List from '../List/List';
import ListItem from '../List/ListItem';
import MainSection from '../List/MainSection';
import GroupSection from '../List/GroupSection';
import AvatarSection from '../List/AvatarSection';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import TextBox from '../TextBox/TextBox';
import SelectionModel from '../SelectionGroup/SelectionModel';
import Validator from '../Validator/Validator';
import Caption from '../Typography/Caption';
import Chip from '../Chip/Chip';
import FormattedMarkdown from '../Markdown/FormattedMarkdown';
import Text from '../Typography/Text';
import FieldMark from '../FieldMark/FieldMark';
import { SEARCH_LIMIT_RESULTS } from '../../../common/helpers/utils';
import Scrollable from '../Scrollable/Scrollable';
import Status from '../Status/Status';
import { document } from '../../../common/helpers/globals';

const ARROW_UP = 38;
const ARROW_DOWN = 40;
const ENTER = 13;
const BACKSPACE = 8;
const TAB = 9;
const ESCAPE = 27;

const nullishOrEmpty = value =>
  nullish(value) || value === '' || (Array.isArray(value) && value.length === 0) || (Array.isArray(value) && value.length === 1 && nullishOrEmpty(value[0]));

const bothAreNullish = (prevValue, nextValue) => nullishOrEmpty(prevValue) && nullishOrEmpty(nextValue);

@observer
export default class Dropdown extends Component {
  constructor(props, context) {
    super(props, context);
    const { selectedValue } = props;
    this.id = generateId(this);
    this.handleChange = debounce(this.handleChange, 50, this);
    this.setQuery = debounce(this.setQuery, 300, this);
    this.handleQueryChange = debounce(this.handleQueryChange, 400, this);

    const model = this.createModel(props);

    if (props.source) {
      // if we have a source callback
      // the filtering is done externally
      // so we don't need to do the filtering
      // of the data, just return all results
      model.filterResults = false;
    }

    if (selectedValue) {
      const selectedV = Array.isArray(selectedValue) ? selectedValue : [selectedValue];
      model.setSelectedByIds(selectedV);
    }

    this.state = {
      model,
      popoverOpen: true,
    };
  }

  createModel(props) {
    const { items = [], multiple, textField, valueField, disabledField, matchQuery, autocomplete, noAutoFocusOnItem, clearFocusOnQueryChange } = props;

    const model = new SelectionModel({
      items,
      multiple,
      textField,
      valueField,
      disabledField,
      matchQuery,
    });

    model.onChange = this.handleChange;

    if (autocomplete) {
      reaction(
        () => {
          const { plainFilteredItems } = model;
          return { plainFilteredItems };
        },
        () => {
          if (noAutoFocusOnItem) return;
          this._focusFirstItem();
        },
      );

      clearFocusOnQueryChange &&
        reaction(
          () => model.query, // any changes of model query should clear the focused item
          () => {
            const { state, $list } = this;
            if (state.focused) {
              $list && $list.find('[data-focused]').removeAttr('data-focused');
            }
          },
        );
    }

    return model;
  }

  _focusFirstItem = debounce(
    () => {
      if (!this._flyout) return;
      const ddOpen = this._flyout.isOpen;
      if (!ddOpen) return;

      let $currentElement = this.$list.find('[data-focused]');

      if ($currentElement.length === 0) {
        $currentElement = this.$list.find('[data-dropdown-item]:first');
        $currentElement.attr('data-focused', 'true');
      }
    },
    100,
    this,
  );

  updateModel(props) {
    const { items = [], multiple, textField, valueField, disabledField, matchQuery } = props;
    const { model } = this.state;

    if (model) {
      model.update({
        items,
        multiple,
        textField,
        valueField,
        disabledField,
        matchQuery,
      });
    }
  }

  static propTypes = {
    id: PropTypes.string,
    positionArgs: PropTypes.object,
    autoClose: PropTypes.bool,
    placeholder: PropTypes.string,
    label: PropTypes.string,
    overlayClassName: PropTypes.string,
    overlayStyle: PropTypes.object,
    showAffordance: PropTypes.bool,
    checkIcon: PropTypes.string,
    unCheckedIcon: PropTypes.string,
    itemClassName: PropTypes.string,
    selectedClassName: PropTypes.string,
    formatSelected: PropTypes.func,
    formatTooltip: PropTypes.func,
    wide: PropTypes.bool,
    items: PropTypes.array,
    lblDone: PropTypes.string,
    lblSelectAll: PropTypes.string,
    lblUnselectAll: PropTypes.string,
    underlineOnEditOnly: PropTypes.bool,
    styled: PropTypes.bool,
    triggerClassName: PropTypes.string,
    triggerStyle: PropTypes.object,
    useTooltip: PropTypes.bool,
    textField: PropTypes.string,
    valueField: PropTypes.string,
    disabledField: PropTypes.string,
    multiple: PropTypes.bool,
    onChange: PropTypes.func,
    onBlur: PropTypes.func,
    autocomplete: PropTypes.bool,
    closeOnSelection: PropTypes.bool,
    matchQuery: PropTypes.func,
    highlightMatches: PropTypes.func,
    source: PropTypes.func,
    queryMinLength: PropTypes.number,
    required: PropTypes.bool,
    requiredMark: PropTypes.string,
    optional: PropTypes.bool,
    optionalMark: PropTypes.string,
    filterable: PropTypes.bool,
    selectAllEnabled: PropTypes.bool,
    disabled: PropTypes.bool,
    callSourceOnFocus: PropTypes.bool,
    showResultsWhenQueryLengthValidate: PropTypes.bool,
    showListOnFocus: PropTypes.bool,
    appendToBody: PropTypes.bool,
    maxLength: PropTypes.number,
  };

  static defaultProps = {
    lblDone: 'Done',
    lblSelectAll: 'Select all',
    lblUnselectAll: 'Unselect all',
    showAffordance: false,
    checkIcon: null,
    unCheckedIcon: null,
    autoClose: true,
    useTooltip: false,
    queryMinLength: 3,
    styled: true, // whether or not the dropdown renders a line like textfields do
    positionArgs: {
      my: 'left top',
      at: 'left top',
    },
    required: false,
    optional: false,
    requiredMark: '*',
    optionalMark: '(optional)',
    filterable: false,
    selectAllEnabled: false,
    disabled: false,
    showResultsWhenQueryLengthValidate: false,
    showListOnFocus: false,
  };

  _getIcon(name) {
    return name ? <Icon name={name} /> : null;
  }

  _getCheckIcon(isSelected, checkIcon, unCheckedIcon) {
    return <AvatarSection>{isSelected ? this._getIcon(checkIcon) : this._getIcon(unCheckedIcon)}</AvatarSection>;
  }

  focus() {
    const { autocomplete } = this.props;
    if (!autocomplete) {
      this.$trigger.focus();
    } else {
      this.$autocompleteWrapper.focus();
    }
  }

  /**
   * sets the value of the autocompleteTextBox
   * @param {string} value
   */
  setAutocompleteQuery(value) {
    this.txtAutocomplete.value = value;
  }

  get $trigger() {
    if (!this._trigger) {
      this._trigger = $(findDOMNode(this)).find('button[data-trigger="true"]');
    }
    return this._trigger;
  }

  get $autocompleteWrapper() {
    if (!this._autocompleteWrapper) {
      this._autocompleteWrapper = $(findDOMNode(this)).find('[data-trigger="true"]');
    }
    return this._autocompleteWrapper;
  }

  _renderGroupItem({ item }) {
    return <Caption>{ellipsis(item.text, 40)}</Caption>;
  }

  _renderItem({ item, selectAffordance, query, autocomplete, highlightMatches }) {
    const text = !autocomplete ? ellipsis(item.text, 60) : highlightMatches(item.text, query);
    return (
      <ListItem>
        {selectAffordance}
        <MainSection>{text}</MainSection>
      </ListItem>
    );
  }

  renderOptions(groups = {}) {
    const { items = [], id = this.id } = groups;
    const { model } = this.state || {};
    const {
      autoClose,
      itemClassName,
      groupItemClassName,
      selectedClassName,
      multiple,
      renderGroupItem,
      renderItem,
      autocomplete,
      closeOnSelection,
      highlightMatches,
      filterable,
      showCurrentSuggestion = false,
      showAutocompleteTextBoxValue,
      onAutocompleteTextBoxChange,
    } = this.props;

    let { showAffordance, checkIcon, unCheckedIcon } = this.props;

    if (multiple) {
      checkIcon = clsc(checkIcon, 'checkbox-marked');
      unCheckedIcon = clsc(unCheckedIcon, 'checkbox-blank-outline');
    }

    showAffordance = showAffordance || (multiple && !autocomplete);

    const rGroupItem = renderGroupItem || this._renderGroupItem;
    const rItem = renderItem || this._renderItem;
    const highlightMatchesFn = highlightMatches || _highlightMatches;

    return items.reduce((acc, item, index) => {
      if (item.items) {
        if ((autocomplete && model.areAllItemsSelected(item.items)) || item.items.length === 0) {
          return acc;
        }

        const groupItem = rGroupItem({ item });

        acc.push(
          <GroupSection key={item.id} className={cf('group-section', g(groupItemClassName))}>
            {groupItem}
          </GroupSection>,
        );
        acc = acc.concat(this.renderOptions(item)); // eslint-disable-line
      } else {
        const isSelected = model.isSelected(item);
        const avatarC = showAffordance ? this._getCheckIcon(isSelected, checkIcon, unCheckedIcon) : null;

        const itemId = `${id ? `${id}_` : ''}${item.id}`;

        const handler = () => {
          model.select(item);

          if (autocomplete) {
            model.setQuery('');
            this.$autocompleteWrapper.val('');
            if (showAutocompleteTextBoxValue) {
              onAutocompleteTextBoxChange && onAutocompleteTextBoxChange({ value: item.text });
            }
            if (closeOnSelection) {
              this.setState({ focused: false });
              this.$autocompleteWrapper.blur();
            } else {
              // this is needed because focusOut can also happen when the
              // item is clicked, so with this we avoid having 2 renders
              // in a fast sequence causing a glitch because the change from
              // rest state to focused state
              clearTimeout(this._clearFocusTimer);

              this.$autocompleteWrapper.focus();
            }
          } else if (!filterable) {
            this.$trigger.focus();
          }

          if (autoClose && !model.multiple) {
            this.closeOverlay();
          }

          if (autocomplete) {
            setTimeout(() => this._checkIfNoMoreElementsToSelect(), 100);
          }

          return false;
        };

        const listItem = rItem({
          item,
          selected: isSelected,
          selectAffordance: avatarC,
          query: model.query,
          autocomplete,
          highlightMatches: highlightMatchesFn,
          index,
        });

        const itemClasses = cf(
          'item-container',
          {
            selected: isSelected && !showAffordance,
            pickbox: isSelected && (checkIcon === 'checkbox-marked' || checkIcon === 'radiobox-marked'),
          },
          g(itemClassName, {
            [selectedClassName]: selectedClassName && isSelected,
          }),
        );
        if (isSelected && autocomplete && !showCurrentSuggestion) {
          // elements taken from the autoComplete set should not be rendered
          return acc;
        }

        acc.push(
          <div key={itemId} data-dropdown-item={true} data-selected={isSelected} onClick={handler} className={itemClasses}>
            {listItem}
          </div>,
        );
      }
      return acc;
    }, []);
  }

  get value() {
    return this.selection();
  }

  set value(selectedValue) {
    const { model } = this.state;
    const selectedV = Array.isArray(selectedValue) ? selectedValue : [selectedValue];
    model.setSelectedByIds(selectedV);
  }

  selection() {
    const { model } = this.state;

    if (model) {
      return model.selection;
    }

    return [];
  }

  handleChange = () => {
    const { onChange } = this.props;
    onChange && onChange(this.selection());
  };

  componentWillReceiveProps(nextProps) {
    let modelChange = false;

    if ('items' in nextProps) {
      const { items } = nextProps;

      if (items !== this.props.items && !isEqual(items, this.props.items)) {
        modelChange = true;
        this.updateModel(nextProps);
      }
    }

    if ('selectedValue' in nextProps) {
      const { selectedValue } = nextProps;
      const selectedValueChanged = selectedValue !== this.props.selectedValue;

      if (selectedValueChanged || modelChange) {
        // since we allow both empty string, null, empty array and an array of an empty or null value
        // we need to check if the value is not attempting to change to any of this.
        // if that is the case, just ignore it, in any case both values have the same effect
        // they remove the selections so nothing will be selected in the UI
        if (bothAreNullish(selectedValue, this.props.selectedValue)) return;

        const { model } = this.state;
        const selectedV = Array.isArray(selectedValue) ? selectedValue : [selectedValue];

        model.setSelectedByIds(selectedV);
      }
    }
  }

  isTooltipEnabled = (tooltip, autocomplete, useTooltip) => tooltip && !autocomplete && useTooltip;

  renderValues(model, renderAutocompleteBox = true) {
    let { formatSelected, formatTooltip, formatChipText, id, showAutocompleteTextBoxValue = false } = this.props;
    const { placeholder, useTooltip, autocomplete, textRoleSecondary, selectedItemStyle, disabled, secondaryTextField = '' } = this.props;
    const list = model.selected || [];
    const emptyList = list.length === 0;
    const textElements = list.map(item => item.text);

    if (!formatChipText) {
      formatChipText = item => item.text;
    }

    if (!formatSelected) {
      formatSelected = args => {
        const selectedValuesAsText = args.selected.reduce((acc, item, i) => {
          const comma = i === args.selected.length - 1 ? '' : ', ';
          acc += `${item.text}${comma}`;
          return acc;
        }, '');
        if (secondaryTextField) {
          return (
            <div>
              <Text>{selectedValuesAsText}</Text>
              <Text className={cf('unit-row', 'value')}>{secondaryTextField}</Text>
            </div>
          );
        }
        if (!autocomplete) {
          const { textElements: _textElements } = args;
          let selectedLabel;
          if (_textElements.length > 1) {
            selectedLabel = `${ellipsis(_textElements[0], 30)}, +${_textElements.length - 1}`;
          } else {
            selectedLabel = _textElements[0];
          }
          return selectedLabel;
        }

        if (!model.multiple) {
          return ellipsis(textElements[0], 40);
        }

        let selectedValues;

        if (args.focused) {
          selectedValues = args.selected.map(item => (
            <Chip
              data-item-selected={true}
              floating
              deletable={true}
              key={item.id}
              text={formatChipText(item)}
              onRemove={() => {
                args.model.unselect(item);
                this.$autocompleteWrapper.focus();
              }}
              className={cf({ unavailable: item.originalItem?.unavailable })}
            />
          ));
        } else {
          selectedValues = (
            <Text className={cf('selected-values')} secondary={textRoleSecondary} inline>
              {selectedValuesAsText}
            </Text>
          );
        }
        return selectedValues;
      };
    }

    if (!formatTooltip) {
      formatTooltip = args => (
        <div>
          {args.selected.map(_item => (
            <div key={_item.id}> {_item.text} </div>
          ))}
        </div>
      );
    }

    let selectedElements;
    const hasElements = textElements.length > 0;
    const dataId = `selectedLabelTxt_${id}`;
    const hasSelectedElementsToShow = hasElements || autocomplete;
    if (hasSelectedElementsToShow) {
      const { focused } = this.state;
      const args = { textElements, selected: list, model, focused };
      const selectedLabel = formatSelected(args);
      const tooltip = formatTooltip(args);
      const className = model.multiple
        ? cf('item-value', {
            'autocomplete-values': autocomplete,
            'as-text': !focused && list.length > 0,
            empty: list.length === 0,
            disabled,
          })
        : cf('item-value', { disabled });
      const selectedWrapper = (
        <div data-component="dropdown-item-value" data-id={dataId} className={className} style={selectedItemStyle}>
          {!showAutocompleteTextBoxValue && selectedLabel}
          {renderAutocompleteBox && this.autocompleteTextBox()}
        </div>
      );
      selectedElements = this.isTooltipEnabled(tooltip, autocomplete, useTooltip) ? <Tooltip text={tooltip}>{selectedWrapper}</Tooltip> : selectedWrapper;
    }

    if (autocomplete) {
      return selectedElements;
    }

    return (
      <div className={cf('item-container')}>
        <div>
          {emptyList && (
            <div data-component="dropdown-item-value" className={cf('item-value placeholder')} data-id={this.props.testId}>
              {ellipsis(placeholder, 40)}
            </div>
          )}
          {selectedElements}
        </div>
      </div>
    );
  }

  handleAnimation({ open, animProps }) {
    animProps.animation = {
      // eslint-disable-line no-param-reassign
      scaleY: open ? 1 : 0,
      opacity: open ? 1 : 0,
      translateY: open ? 0 : '-10%',
      transformOriginX: ['50%', '50%'],
      transformOriginY: ['0', '0'],
    };
  }

  get $list() {
    return $(findDOMNode(this._list));
  }

  _handleOpen = () => {
    const firstOpenItem = this.$list.find('[data-selected="true"]')[0];
    scrollIntoView(firstOpenItem);

    const { autocomplete, multiple } = this.props;

    this.$DOMNode.on(`keydown.navigation_ns_${this.id}`, (e) => { // eslint-disable-line
      const keyCode = e.keyCode;

      if (keyCode === ESCAPE) {
        this.closeOverlay();
        return;
      }

      if (e.keyCode === ENTER) {
        const { target } = e;

        if ($(target).closest('[data-component="flyout-actions"]').length > 0) return;

        this._selectFocusedItem();
        return false; // eslint-disable-line
      }

      if (keyCode === TAB) {
        if (!multiple) {
          this._selectFocusedItem();
          return;
        }

        if (autocomplete) {
          this._selectFocusedItem();
          return false; // eslint-disable-line
        }

        return;
      }

      if (keyCode === ARROW_UP) {
        this._goUpInList();
        return false; // eslint-disable-line
      }

      if (keyCode === ARROW_DOWN) {
        this._goDownInList();
        return false; // eslint-disable-line
      }
    });
  };

  get $DOMNode() {
    if (!this._$domNode) {
      this._$domNode = $(this.DOMNode);
    }
    return this._$domNode;
  }

  closeOverlay() {
    const { autocomplete } = this.props;

    if (autocomplete) {
      this.setState({ popoverOpen: false });
    } else {
      this._flyout.close();
    }
  }

  handleOpen = () => {
    const THRESHOLD_TO_WAIT_ELEMENTS_VISIBLE = 30;
    setTimeout(this._handleOpen, THRESHOLD_TO_WAIT_ELEMENTS_VISIBLE);
  };

  _removeLastItem() {
    const { model } = this.state;

    const selected = model.selected || [];

    if (selected.length === 0) return;

    const lastItem = selected[selected.length - 1];
    model.unselect(lastItem);
  }

  _removeFocused() {
    const $currentElement = this.$list.find('[data-focused]');
    $currentElement.removeAttr('data-focused');
  }

  _selectFocusedItem() {
    const $currentElement = this.$list.find('[data-focused]');

    const hasFocusedElement = $currentElement.length > 0;

    if (!hasFocusedElement) {
      this.closeOverlay();
      return;
    }

    $currentElement.trigger('click');
    this._checkIfNoMoreElementsToSelect();
  }

  _checkIfNoMoreElementsToSelect() {
    const $elements = this.$list.find('[data-component="list-item"]');
    if ($elements.length === 0) {
      const { onNoMoreItemsToSelect } = this.props;
      onNoMoreItemsToSelect && onNoMoreItemsToSelect();
    }
  }

  _getDropdownItemByDirection($element, direction) {
    let attempts = 2;
    while (attempts > 0) {
      const $prev = $element[direction](); // direction ==> prev/next
      if ($prev.is('[data-dropdown-item]')) {
        return $prev;
      }
      $element = $prev;
      attempts--;
    }
    return $([]);
  }

  _navigateList(direction) {
    const filter = direction === 'next' ? 'first' : 'last';

    let $currentElement = this.$list.find('[data-focused]');

    if ($currentElement.length === 0) {
      $currentElement = this.$list.find('[data-selected="true"]:first');
    }

    if ($currentElement.length === 0) {
      $currentElement = this.$list.find(`[data-dropdown-item]:${filter}`);
      $currentElement.attr('data-focused', 'true');
      return;
    }

    $currentElement.removeAttr('data-focused');
    const $next = this._getDropdownItemByDirection($currentElement, direction);

    if ($next.length === 0) return;

    scrollIntoView($next[0]);
    $next.attr('data-focused', 'true');
  }

  _goDownInList() {
    this._navigateList('next');
  }

  _goUpInList() {
    this._navigateList('prev');
  }

  handleClose = () => {
    const { model } = this.state;
    const { autocomplete, filterable, onClose } = this.props;

    onClose && onClose(this.selection());

    if (autocomplete) {
      return;
    }

    if (filterable && this.txtFilter) {
      this.txtFilter.value = '';
      model.setQuery('');
      return;
    }
  };

  handleClosing = () => {
    this.$DOMNode.off(`keyup.navigation_ns_${this.id} keydown.navigation_ns_${this.id}`);
    this.$list.find('[data-focused]').removeAttr('data-focused');
  };

  @action
  setQuery = async (val, force) => {
    const { source, queryMinLength } = this.props;
    const { model, popoverOpen } = this.state;

    if ((model.query !== val || force) && !popoverOpen) {
      this.setState({
        popoverOpen: true,
      });
    }

    if (source && (val.length >= queryMinLength || force)) {
      this.setState({ loading: true });

      model.setQuery(val);

      try {
        const items = await source({ query: val });
        model.replaceData(items);
        this.setState({ loading: false });
        if (this.scrollableRef) {
          this.scrollableRef.updateScrollProps();
        }
      } catch (ex) {
        console.log(`Search query error:  ${ex}`);
        this.setState({ loading: false });
      }
    } else {
      model.setQuery(val);
    }
  };

  // handle changes on autocompleteTextBox
  // it emits the onAutocompleteTextBoxChange event
  // and sets the query for search to be performed
  handleOnChange = async ({ value }) => {
    const { onAutocompleteTextBoxChange, source } = this.props;
    onAutocompleteTextBoxChange && onAutocompleteTextBoxChange({ value });

    if (source && !value) {
      await this.setQuery(value, true);
    } else {
      await this.setQuery(value);
    }
  };

  _handleFocus = e => {
    if (e.target === this.$autocompleteWrapper[0]) {
      this.setState({ focused: true, popoverOpen: true });
      const { callSourceOnFocus } = this.props;
      if (callSourceOnFocus && !this.txtAutocomplete.value) {
        this.setQuery(this.txtAutocomplete.value, true);
      }
    }
  };

  get DOMNode() {
    if (!this._domNode) {
      this._domNode = findDOMNode(this);
    }
    return this._domNode;
  }

  _handleBlur = e => {
    if (e.target === this.DOMNode) {
      this._clearFocus();
    }
    const { model } = this.state;

    const { onBlur } = this.props;
    onBlur && onBlur(model.query);
  };

  _clearFocus() {
    if (!this.state.focused || contains(this.DOMNode, document.activeElement) || contains(this._flyoutOverlay, document.activeElement)) {
      return;
    }

    this.setState({ focused: false });
  }

  _handleCloseRequest = ({ source, target }) => {
    if (source === 'tapAway' && contains(this.DOMNode, target)) {
      return;
    }

    this._clearFocus();
  };

  renderEmptyResults = () => {
    let { emptyResultsTemplate } = this.props;
    const { model } = this.state;

    if (!emptyResultsTemplate) {
      emptyResultsTemplate = query => <FormattedMarkdown className={cf('card-template')}>{t('NO_RESULTS', { query })}</FormattedMarkdown>;
    }

    return emptyResultsTemplate(model.query);
  };

  _handleFocusOut = () => {
    const THRESHOLD_TO_WAIT_BEFORE_CLEAR_FOCUS = 100;
    this._clearFocusTimer = setTimeout(() => this._clearFocus(), THRESHOLD_TO_WAIT_BEFORE_CLEAR_FOCUS);
  };

  _handleKeysInDropdownTrigger = e => {
    // only handle the key events in case the
    // drpodown is focused
    if (!this.state.focused) {
      return;
    }

    const keyCode = e.keyCode;
    const ddOpen = this._flyout.isOpen;
    const { autocomplete } = this.props;

    const isDownOrUp = keyCode === ARROW_UP || keyCode === ARROW_DOWN;
    const shouldTheOverlayBeOpened = isDownOrUp && !ddOpen && !autocomplete;

    if (shouldTheOverlayBeOpened) {
      this._flyout.open();
      // prevent the screen from scrolling
      e.preventDefault();
      e.stopPropagation();
    }
  };

  _handleKeyPressInDropdownTrigger = e => {
    const keyCode = e.keyCode;
    const { filterable } = this.props;

    if (!filterable) {
      this.preventSelect = false;
      return;
    }

    if (keyCode !== ARROW_UP && keyCode !== ENTER && keyCode !== TAB && keyCode !== BACKSPACE) {
      if (this._flyout.isOpen) {
        return; // should already be handled by the other listeners
      }

      this.txtFilter.focus();
      this.txtFilter.value = e.key;
      this.preventSelect = true;
      this._flyout.open();
    }
  };

  componentDidMount() {
    const { filterable } = this.props;
    this.$DOMNode.on(`focusout.ns_${this.id}`, this._handleFocusOut);
    filterable && this.$DOMNode.on(`keypress.ns_${this.id}`, this._handleKeyPressInDropdownTrigger);
    this.$DOMNode.on(`keydown.ns_${this.id}`, this._handleKeysInDropdownTrigger);
  }

  componentWillUnmount() {
    this.$DOMNode.off(`.ns_${this.id}`);
    this.$DOMNode.off(`.navigation_ns_${this.id}`);
    clearTimeout(this._clearFocusTimer);
  }

  renderNoMoreResults() {
    let { noMoreItemsTemplate } = this.props;

    if (!noMoreItemsTemplate) {
      noMoreItemsTemplate = () => <FormattedMarkdown className={cf('card-template')}>{t('THERE_NO_MORE_ITEMS')}</FormattedMarkdown>;
    }

    return noMoreItemsTemplate();
  }

  handleKeyDown = e => {
    const { popoverOpen } = this.state;

    if ((e.keyCode === ARROW_DOWN || e.keyCode === ARROW_UP) && !popoverOpen) {
      this.setState({ popoverOpen: true });

      e.preventDefault();
      e.stopPropagation();
    }
  };

  handleKeyUp = e => {
    const previousValue = this._previousValue;
    const keyCode = e.keyCode;
    const val = this.$autocompleteWrapper.val();

    if (keyCode === BACKSPACE) {
      if (val === '' && !previousValue) {
        this._removeLastItem();
      }
    }

    this._previousValue = val;

    const { onEnterPressOnTextBox } = this.props;

    if (e.keyCode === ENTER && onEnterPressOnTextBox) {
      const value = e.target.value;
      const args = { value, autoClose: true };
      onEnterPressOnTextBox(e, args);

      if (args.autoClose) {
        this.closeOverlay();
      }
    }
  };

  _handlePosition = args => {
    const $trigger = this.$DOMNode.find(`.${cf('dropdown')}`);

    args.position = {
      my: 'left top',
      at: 'left bottom',
      of: $trigger,
    };
  };

  handleOpenDone = () => {
    const { filterable } = this.props;

    if (this.scrollableRef) {
      this.scrollableRef.updateScrollProps();
    }

    if (!filterable) return;
    this.txtFilter.focus();

    if (this.preventSelect) {
      this.preventSelect = false;
      return;
    }

    this.txtFilter.select();
  };

  handleQueryChange() {
    let $currentElement = this.$list.find('[data-focused]');

    if ($currentElement.length === 0) {
      $currentElement = this.$list.find('[data-dropdown-item]:first');
      $currentElement.attr('data-focused', 'true');
      return;
    }
  }

  _handleFilterChange = async () => {
    const value = this.txtFilter.value;
    this.setQuery(value);
    await this.handleQueryChange();
  };

  _renderFooter = () => (
    <Text className={cf('footer-message')} secondary>
      {t('FOOTER_MESSAGE_MATCHES_DROPDOWN', {
        limitNumber: SEARCH_LIMIT_RESULTS,
      })}
    </Text>
  );

  renderFooterInfo = () => {
    const { renderFooter } = this.props;
    const {
      model: { items, plainFilteredItems },
      loading,
    } = this.state;
    const rFooterInfo = renderFooter || this._renderFooter;
    return !loading && items && plainFilteredItems.length >= SEARCH_LIMIT_RESULTS && rFooterInfo({ items });
  };

  storeScrollableRef = ref => {
    this.scrollableRef = ref;
  };

  renderNoItems = args => {
    const { useMore } = args || {};
    let { noItemsTemplate } = this.props;

    if (!noItemsTemplate) {
      noItemsTemplate = (/* args */) => (
        <FormattedMarkdown className={cf('card-template')}>{t(useMore ? 'NO_MORE_ITEMS_TO_SELECT' : 'NO_ITEMS_TO_SELECT')}</FormattedMarkdown>
      );
    }

    return noItemsTemplate(args);
  };

  @action
  setAndUnsetChecks = value => {
    value ? this.state.model.selectAll() : this.state.model.unselectAll();
  };

  storeAutoCompleteRef = ref => {
    this.txtAutocomplete = ref;
  };

  storeFlyOutRef = ref => {
    this._flyout = ref;
  };

  storeFlyOutOverlayRef = ref => {
    this._flyoutOverlay = ref;
  };

  storeFilterRef = ref => {
    this.txtFilter = ref;
  };

  storeListRef = ref => {
    this._list = ref;
  };

  autocompleteTextBox = () => {
    const {
      textBoxIconAffordance,
      textBoxWideIcon,
      textBoxShowClear,
      id,
      maxLength,
      placeholder,
      label,
      required,
      optional,
      requiredMark,
      optionalMark,
      showAutocompleteTextBoxValue,
    } = this.props;

    const { focused, model } = this.state;
    const empty = model.selected.length === 0;
    const theLabel = toSentenceCase(trim(label));
    const fieldProps = { required, optional, requiredMark, optionalMark };
    const theId = clsc(id, this.id);

    const labelC = theLabel ? (
      <label className={cf('label', { active: focused || !empty || model.query })} htmlFor={theId}>
        {theLabel} <FieldMark {...fieldProps} />
      </label>
    ) : null;

    const placeholderValue = (focused && empty) || (!labelC && empty) ? placeholder : undefined;

    return (
      <TextBox
        ref={this.storeAutoCompleteRef}
        underline={false}
        placeholder={placeholderValue}
        onKeyUp={this.handleKeyUp}
        onKeyDown={this.handleKeyDown}
        persistSameInput={showAutocompleteTextBoxValue}
        iconAffordance={textBoxIconAffordance}
        value={this.props.autocompleteTextBoxValue}
        wideIcon={textBoxWideIcon}
        showClear={textBoxShowClear}
        className={cf('autocomplete-textbox')}
        data-trigger="true"
        autoComplete="off"
        onChange={this.handleOnChange}
        id={id}
        maxLength={maxLength}
      />
    );
  };

  render() {
    const {
      className,
      positionArgs,
      overlayClassName,
      id,
      errorMessage,
      label,
      style,
      styled,
      lblDone,
      lblSelectAll,
      lblUnselectAll,
      multiple,
      triggerStyle,
      triggerClassName,
      autocomplete,
      source,
      underlineOnEditOnly,
      wide,
      meta,
      required,
      optional,
      requiredMark,
      optionalMark,
      filterable,
      selectAllEnabled,
      overlayStyle,
      disabled,
      callSourceOnFocus,
      showFooter,
      queryMinLength,
      showResultsWhenQueryLengthValidate,
      showListOnFocus,
      subtleLoading,
      appendToBody,
    } = this.props;

    const { model, loading } = this.state;
    const theId = clsc(id, this.id);

    const errorMessageId = `${theId}-err-msg`;
    const theMessage = trim(errorMessage);
    const valid = theMessage === '';
    const empty = model.selected.length === 0;
    const theLabel = toSentenceCase(trim(label));
    const fieldProps = { required, optional, requiredMark, optionalMark };
    const { focused, popoverOpen } = this.state;

    const labelC = theLabel ? (
      <label className={cf('label', { active: focused || !empty || model.query })} htmlFor={theId}>
        {theLabel} <FieldMark {...fieldProps} />
      </label>
    ) : null;

    let triggerElement;

    if (!autocomplete) {
      triggerElement = (
        <Button
          id={theId}
          data-trigger="true"
          type="wrapper"
          style={triggerStyle}
          className={cf('dropdown', { 'no-valid': !valid, styled }, g(triggerClassName))}
          disabled={disabled}>
          {this.renderValues(model, false)}
          {labelC}
          <span data-component="dropdown-caret-affordance" className={cf('icon-wrapper')}>
            <Icon name="menu-down" />
          </span>
        </Button>
      );
    }

    let autoCompleteTrigger;

    const flyOutAutocompleteArgs = {};

    if (autocomplete) {
      let open;
      const hasQuery = !!trim(model.query);

      if (showListOnFocus && !hasQuery) {
        open = focused && popoverOpen;
      } else {
        const shouldBeOpen = focused && popoverOpen && (hasQuery || model.selection.ids.length === 0);
        open = source ? (!!trim(model.query) || (callSourceOnFocus && !trim(model.query))) && shouldBeOpen : shouldBeOpen;
      }

      flyOutAutocompleteArgs.usePrevSiblingAsTrigger = true;
      flyOutAutocompleteArgs.open = open;
      flyOutAutocompleteArgs.onPosition = this._handlePosition;
      flyOutAutocompleteArgs.onCloseRequest = this._handleCloseRequest;

      autoCompleteTrigger = (
        <div
          id={theId}
          style={triggerStyle}
          className={cf(
            'dropdown',
            {
              'autocomplete-wrapper': autocomplete,
              'no-valid': !valid,
              styled,
              focused,
              underlineOnEditOnly,
            },
            g(triggerClassName),
          )}>
          {this.renderValues(model)}
          {labelC}
        </div>
      );
    }

    const requiredQueryLength = !showResultsWhenQueryLengthValidate || (model.query && model.query.length >= queryMinLength);

    const renderList = () => {
      // eslint-disable-next-line prefer-const
      let { plainFilteredItems, query } = model || {};
      plainFilteredItems = plainFilteredItems || [];

      if (autocomplete) {
        if (loading && query !== '' && !subtleLoading) {
          return <div className={cf('loading-items')}> {t('LOADING')} </div>;
        }

        const emptyQuery = trim(model.query) === '';

        if (plainFilteredItems.length === 0 && !emptyQuery) {
          return this.renderEmptyResults();
        }

        const results = this.renderOptions(model);

        const itemsWithoutTheSelectedOnes = model.plainFilteredItemsWithoutSelected;

        const areAllTheItemsSelected = (itemsWithoutTheSelectedOnes || []).length === 0;

        if (multiple && areAllTheItemsSelected) {
          if (!query) {
            return this.renderNoItems({ useMore: true });
          }
          return this.renderNoMoreResults();
        }

        return results;
      }

      if (plainFilteredItems.length === 0) {
        return this.renderNoItems({ query });
      }

      return this.renderOptions(model);
    };

    const metaProps = dataProps(meta);

    return (
      <div
        {...metaProps}
        className={cf('dropdown-wrapper', { wide, focused, hasLabel: !!labelC, noLabel: !labelC }, g(className))}
        style={style}
        data-id={`dd-${theId}`}
        data-component="dropdown"
        onBlur={this._handleBlur}
        onFocus={this._handleFocus}>
        {autoCompleteTrigger}
        <FlyOut
          ref={this.storeFlyOutRef}
          appendToBody={appendToBody}
          onOpening={this.handleOpen}
          onOpen={this.handleOpenDone}
          onClosing={this.handleClosing}
          onClose={this.handleClose}
          positionArgs={positionArgs}
          {...flyOutAutocompleteArgs}>
          {triggerElement}
          <FlyOutOverlay
            tabIndex={0}
            ref={this.storeFlyOutOverlayRef}
            animationFn={this.handleAnimation}
            container={false}
            elevation={2}
            style={overlayStyle}
            data-id={`overlay-${theId}`}
            className={cf('overlay', g(overlayClassName))}>
            {subtleLoading && <Status processing={loading} />}
            {filterable && (
              <div className={cf('filter')}>
                <TextBox
                  autoComplete="none"
                  ref={this.storeFilterRef}
                  onInput={this._handleFilterChange}
                  iconAffordance="magnify"
                  wide
                  wideIcon
                  underline={false}
                />
              </div>
            )}
            {requiredQueryLength && (
              <Scrollable ref={this.storeScrollableRef} className={cf('list')}>
                <List ref={this.storeListRef}>{renderList()}</List>
              </Scrollable>
            )}
            {showFooter && this.renderFooterInfo()}
            {multiple && !autocomplete && (
              <FlyOutActions className={cf('actions', { selectAllEnabled })}>
                {selectAllEnabled && (
                  <Button
                    id={`${theId}_toggleItemsBtn`}
                    type="flat"
                    btnRole="secondary"
                    label={!model.areAllItemsChecked ? lblSelectAll : lblUnselectAll}
                    onClick={() => this.setAndUnsetChecks(!model.areAllItemsChecked)}
                  />
                )}
                <Button id={`${theId}_doneBtn`} label={lblDone} type="flat" data-action="close" />
              </FlyOutActions>
            )}
          </FlyOutOverlay>
        </FlyOut>
        {errorMessage && (
          <Validator id={errorMessageId} visible={!valid}>
            {errorMessage}
          </Validator>
        )}
      </div>
    );
  }
}
