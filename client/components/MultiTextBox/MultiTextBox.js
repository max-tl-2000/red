/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import trim from 'helpers/trim';
import generateId from 'helpers/generateId';
import { autorun } from 'mobx';
import debounce from 'debouncy';
import clsc from 'helpers/coalescy';
import { cf, g } from './MultiTextBox.scss';
import TextFieldWrapper from './TextFieldWrapper';
import MultiTextCollection from './MultiTextCollection';
import Validator from '../Validator/Validator';
import TextBox from '../TextBox/TextBox';

const defaultSorterFn = (a, b) => (a.id > b.id ? 1 : -1);

@observer
export default class MultiTextBox extends Component {
  static propTypes = {
    label: PropTypes.string,
    values: PropTypes.array,
    itemLabel: PropTypes.string,
    itemPlaceholder: PropTypes.string,
    itemValidation: PropTypes.func,
    defaultError: PropTypes.string,
    className: PropTypes.string,
    onChange: PropTypes.func,
    errorMessage: PropTypes.string,
    raiseChangeThreshold: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.id = generateId(this);
    const model = new MultiTextCollection({
      items: props.values,
      itemValidation: props.itemValidation,
      defaultError: props.defaultError,
    });
    this.state = { model };

    const DEBOUNCE_THRESHOLD = clsc(props.raiseChangeThreshold, 400);

    this.raiseChange = debounce(this._raiseChange, DEBOUNCE_THRESHOLD, this);
    this.raiseBlur = debounce(this.raiseBlur, DEBOUNCE_THRESHOLD + 50, this); // this has to happen after the change event fired
    this.firstTime = true;

    this.disposer = autorun(() => {
      const { serialized, nonEmptySerialized } = model;

      if (this.firstTime) {
        this.firstTime = false;
        return;
      }

      if (this.disableOnChange) return;
      this.raiseChange(serialized, nonEmptySerialized);
    });
  }

  setValues(values) {
    const { model } = this.state;
    this.disableOnChange = true;

    if (!values || values.length === 0) {
      model.clear();
    }

    model.replaceItems(values);
    this.disableOnChange = false;
  }

  set values(values) {
    this.setValues(values);
  }

  componentWillUnmount() {
    this.disposer && this.disposer();
  }

  isDifferentEntry = (entryA, entryB) => entryA.id !== entryB.id || entryA.value !== entryB.value;

  receivedValuesAreDifferentFromExitingOnes(newValues = [], prevValues = []) {
    if (prevValues.length !== newValues.length) return true;

    const sortedNewValues = [...newValues].sort(defaultSorterFn);
    const sortedPrevValues = [...prevValues].sort(defaultSorterFn);
    return sortedNewValues.some((entry, index) => this.isDifferentEntry(entry, sortedPrevValues[index]));
  }

  componentWillReceiveProps(nextProps) {
    if ('values' in nextProps) {
      if (!this.receivedValuesAreDifferentFromExitingOnes(nextProps.values, this._lastValues)) {
        return;
      }
      this.setValues(nextProps.values);
      this._lastValues = nextProps.values;
    }
  }

  _raiseChange() {
    const { model } = this.state;
    const { onChange, useChildErrorValidation } = this.props;
    if (!useChildErrorValidation) this._lastValues = model.serialized;

    onChange &&
      onChange({
        values: model.serialized,
        nonEmptyValues: model.nonEmptySerialized,
      });
  }

  raiseBlur(item, items) {
    !item.isFirst && item.validate(items);
    const { onBlur } = this.props;
    onBlur && onBlur();
  }

  clear() {
    const { model } = this.state;
    model.clear();
  }

  get valid() {
    const { model } = this.state;
    return model.valid;
  }

  validate() {
    const { model } = this.state;
    if (!model) {
      return Promise.resolve(); // a promise is expected to be returned
    }

    return model.validate();
  }

  doRenderComponent(props) {
    return <TextBox wide showClear {...props} />;
  }

  addNew = () => {
    const { model } = this.state;
    model.add('');
  };

  get values() {
    const { model } = this.state;
    return model.serialized;
  }

  get nonEmptyValues() {
    const { model } = this.state;
    return model.nonEmptySerialized;
  }

  get renderComponentFn() {
    const { renderComponent = this.doRenderComponent } = this.props;
    return renderComponent;
  }

  handleChange = (item, value, noDebounce) => {
    item.updateValue(value);
    const { onItemChange } = this.props;
    onItemChange && onItemChange({ value });

    if (noDebounce) {
      this._raiseChange();
    }
  };

  render() {
    const { itemLabel, itemPlaceholder, label, id = this.id, className, errorMessage } = this.props;

    const { model } = this.state;
    const valid = !errorMessage;
    const errorMessageId = `${id}-err-msg`;
    const items = model.items;

    return (
      <div id={id} data-component="multi-textbox" className={cf('multi-textbox', g(className))}>
        {label && <label htmlFor={id}>{label}</label>}
        <div>
          {items.map((item, index) => (
            <TextFieldWrapper
              key={item.id}
              renderComponent={this.renderComponentFn}
              onNewClick={this.addNew}
              errorMessage={item.error}
              value={item.value}
              label={itemLabel}
              last={index === items.length - 1}
              autoFocus={!item.isFirst && !trim(item.value)}
              showAdd={trim(item.value) && index === items.length - 1}
              onFocus={() => item.isFirst && model.addFirst('')}
              placeholder={itemPlaceholder}
              onBlur={() => this.raiseBlur(item, items)}
              onChange={({ value, noDebounce }) => this.handleChange(item, value, noDebounce)}
              item={item}
            />
          ))}
        </div>
        {/* there is validation happening onBlur in this component,
                   so if that was enabled we only need to show this error
                   message if the model was valid but we still receive an
                   errorMessage (this can happen when all phones are valid)
                   but there are duplicated entries for example */}
        {errorMessage && !valid && model.valid && (
          <Validator visible id={errorMessageId}>
            {errorMessage}
          </Validator>
        )}
      </div>
    );
  }
}
