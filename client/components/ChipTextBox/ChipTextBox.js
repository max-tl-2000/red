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
import trim from 'helpers/trim';
import $ from 'jquery';
import debounce from 'debouncy';
import { observer } from 'mobx-react';
import contains from 'helpers/contains';
import Chip from '../Chip/Chip';
import Text from '../Typography/Text';
import Validator from '../Validator/Validator';
import { cf, g } from './ChipTextBox.scss';
import { ListModel } from './ListModel';
import { document } from '../../../common/helpers/globals';

const BACKSPACE = 8;
const ENTER = 13;
const COMMA = 188;
const TAB = 9;
const ADD_ITEM_KEYS = [ENTER, TAB, COMMA];

@observer
export default class ChipTextBox extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.handleChange = debounce(this.handleChange, 50, this);

    const model = this.createModel(props);

    this.state = {
      model,
    };
  }

  createModel(props) {
    const model = new ListModel({
      items: props.value,
      validation: props.validator,
    });
    model.onChange = this.handleChange;
    return model;
  }

  static propTypes = {
    id: PropTypes.string,
    placeholder: PropTypes.string,
    label: PropTypes.string,
    value: PropTypes.array,
    wide: PropTypes.bool,
    maxNumItems: PropTypes.number,
    styled: PropTypes.bool,
    forceLowerCase: PropTypes.bool,
    triggerClassName: PropTypes.string,
    triggerStyle: PropTypes.object,
    onChange: PropTypes.func,
    addItemKeyCodes: PropTypes.array,
    disabled: PropTypes.bool,
    onBlur: PropTypes.func,
  };

  static defaultProps = {
    styled: true,
    addItemKeyCodes: ADD_ITEM_KEYS,
  };

  componentWillReceiveProps(nextProps) {
    if ('value' in nextProps) {
      const { value } = nextProps;

      if (value !== this.props.value) {
        const { model } = this.state;
        if (model) {
          // this should be smart enough
          // to merge the new state without
          // causing a new onChange event
          // to happen. On change event should
          // only be allowed if the change comes
          // from a user action and not from a
          // change in the parent state
          model.silentUpdate(value);
        }
      }
    }
  }

  get $autocompleteWrapper() {
    if (!this._autocompleteWrapper) {
      this._autocompleteWrapper = $(findDOMNode(this)).find('[data-trigger="true"]');
    }
    return this._autocompleteWrapper;
  }

  get value() {
    const { model } = this.state;
    return { value: model.value };
  }

  set value(value) {
    const { model } = this.state;
    model.update(value);
  }

  handleChange = () => {
    const { onChange } = this.props;
    onChange && onChange(this.value);
  };

  renderValues(model, textBox, placeholderValue) {
    const format = args => {
      let selectedValues;
      if (args.focused) {
        selectedValues = args.model.values.map(item => (
          <Chip
            data-item-selected={true}
            deletable={true}
            key={item.id}
            text={item.text}
            error={!item.valid}
            onRemove={() => {
              args.model.remove(item);
              this.$autocompleteWrapper.focus();
            }}
          />
        ));
      } else {
        let selectedValuesAsText = args.model.values.reduce((acc, item) => {
          if (!item.error) {
            acc += `, ${item.text}`;
          }
          return acc;
        }, '');
        selectedValuesAsText = selectedValuesAsText.substring(2);
        selectedValues = selectedValuesAsText.length ? (
          <Text inline secondary className={cf('selectedValues')}>
            {selectedValuesAsText}
          </Text>
        ) : (
          <Text inline className={cf('placeholder')} disabled>
            {placeholderValue}
          </Text>
        );
      }
      return selectedValues;
    };

    const { focused } = this.state;
    const args = { model, focused };
    const selectedLabel = format(args);
    return (
      <div
        data-component="chiptextbox-item-value"
        className={cf('item-value', 'autocomplete-values', {
          'as-text': !focused && model.values.length > 0,
          empty: !focused && model.values.length === 0,
        })}>
        {selectedLabel}
        {textBox}
      </div>
    );
  }

  get $DOMNode() {
    if (!this._$domNode) {
      this._$domNode = $(this.DOMNode);
    }
    return this._$domNode;
  }

  _removeLastItem() {
    const { model } = this.state;
    if (model.length === 0) return;

    const lastItem = model.values[model.length - 1];
    model.remove(lastItem);
  }

  _addItem(text) {
    text = trim(text);
    const { maxNumItems, forceLowerCase } = this.props;

    if (forceLowerCase) {
      text = text.toLowerCase();
    }

    const { model } = this.state || {};

    if (text === '' || (maxNumItems && model.length >= maxNumItems)) {
      this.$autocompleteWrapper.text('');
      return;
    }

    model.add({ id: generateId(this), text });
    this.$autocompleteWrapper.text('');
  }

  _removeItemsWithError() {
    const { model } = this.state || {};
    const text = this.$autocompleteWrapper.text();
    this._addItem(text);
    model.removeNotValidItems();
  }

  _handleFocus = e => {
    if (e.target === this.$autocompleteWrapper[0]) {
      this.setState({ focused: true });
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
    const { onBlur } = this.props;
    onBlur && onBlur();
  };

  _clearFocus() {
    if (!this.state.focused || contains(this.DOMNode, document.activeElement)) {
      return;
    }

    this.setState({ focused: false });
  }

  _handleFocusOut = () => {
    this._removeItemsWithError();
    const THRESHOLD_TO_WAIT_BEFORE_CLEAR_FOCUS = 100;
    this._clearFocusTimer = setTimeout(() => this._clearFocus(), THRESHOLD_TO_WAIT_BEFORE_CLEAR_FOCUS);
  };

  componentDidMount() {
    this.$DOMNode.on(`focusout.ns_${this.id}`, this._handleFocusOut);
  }

  componentWillUnmount() {
    this.$DOMNode.off(`.ns_${this.id}`);
    clearTimeout(this._clearFocusTimer);
  }

  handleKeyDown = e => {
    const keyCode = e.keyCode;
    if (this.props.addItemKeyCodes.includes(keyCode)) {
      if (this.$autocompleteWrapper.text() === '' && keyCode === TAB) {
        return; // do not prevent default in case of tab when there is no value in the textwrapper
      }
      e.preventDefault();
    }
  };

  handleKeyUp = e => {
    const previousValue = this._previousValue;
    const keyCode = e.keyCode;
    const val = this.$autocompleteWrapper.text();

    if (keyCode === BACKSPACE) {
      if (val === '' && !previousValue) {
        this._removeLastItem();
      }
      this._previousValue = val;
    } else if (this.props.addItemKeyCodes.includes(keyCode)) {
      this._addItem(val);
    }
  };

  render() {
    const { className, id, errorMessage, label, style, styled, triggerStyle, triggerClassName, placeholder, disabled, wide } = this.props;

    const { model } = this.state;
    const theId = clsc(id, this.id);

    const errorMessageId = `${theId}-err-msg`;
    const theMessage = trim(errorMessage);
    const valid = theMessage === '';

    const theLabel = trim(label);
    const labelC = theLabel ? <label htmlFor={theId}>{theLabel}</label> : null;

    const { focused } = this.state;

    const placeholderValue = model.length === 0 ? placeholder : undefined;

    const textBox = (
      <div onKeyDown={this.handleKeyDown} contentEditable={!disabled} onKeyUp={this.handleKeyUp} className={cf('chiptextbox-textbox')} data-trigger="true" />
    );

    const trigger = (
      <div
        id={theId}
        style={triggerStyle}
        className={cf('chiptextbox', 'textbox-wrapper', { 'no-valid': !valid, styled, focused, disabled }, g(triggerClassName))}>
        {this.renderValues(model, textBox, placeholderValue)}
      </div>
    );

    return (
      <div
        className={cf('chiptextbox-wrapper', { wide }, g(className))}
        style={style}
        data-component="chiptextbox"
        onBlur={this._handleBlur}
        onFocus={this._handleFocus}>
        {labelC}
        {trigger}
        {errorMessage && (
          <Validator id={errorMessageId} visible={!valid}>
            {errorMessage}
          </Validator>
        )}
      </div>
    );
  }
}
