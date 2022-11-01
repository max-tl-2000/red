/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import trim from 'helpers/trim';
import clsc from 'helpers/coalescy';
import shallowCompare from 'helpers/shallowCompare';
import { observer } from 'mobx-react';
import SelectionModel from './SelectionModel';
import { cf, g } from './SelectionGroup.scss';
import PickBox from '../PickBox/PickBox';
import Validator from '../Validator/Validator';
import Caption from '../Typography/Caption';
import FieldMark from '../FieldMark/FieldMark';

const SelectionItem = observer(({ children, ...props }) => <div {...props}>{children}</div>);

@observer
export default class SelectionGroup extends Component {
  constructor(props, context) {
    super(props, context);
    const { selectedValue } = props;
    this.id = generateId(this);

    const model = this.createModel(props);

    if (selectedValue) {
      const selectedV = Array.isArray(selectedValue) ? selectedValue : [selectedValue];
      model.setSelectedByIds(selectedV);
    }

    this.state = { model };
  }

  createModel(props) {
    const { items = [], multiple, textField, valueField, disabledField } = props;

    const model = new SelectionModel({
      items,
      multiple,
      textField,
      valueField,
      disabledField,
    });

    model.onChange = this.handleChange;

    return model;
  }

  updateModel(props) {
    const { items = [], multiple, textField, valueField, disabledField } = props;

    if (this.state.model) {
      this.state.model.update({
        items,
        multiple,
        textField,
        valueField,
        disabledField,
      });
    }
  }

  static propTypes = {
    id: PropTypes.string,
    label: PropTypes.string,
    items: PropTypes.array,
    onChange: PropTypes.func,
    multiple: PropTypes.bool,
    textField: PropTypes.string,
    valueField: PropTypes.string,
    disabledField: PropTypes.string,
    columns: PropTypes.number,
    // the className of the item element
    elementClassName: PropTypes.string,
    itemTemplate: PropTypes.func,
    groupTemplate: PropTypes.func,
    itemGutter: PropTypes.number,
    required: PropTypes.bool,
    requiredMark: PropTypes.string,
    optional: PropTypes.bool,
    optionalMark: PropTypes.string,
    readOnly: PropTypes.bool,
  };

  static defaultProps = {
    multiple: false,
    itemGutter: 24,
    required: false,
    optional: false,
    readOnly: false,
    requiredMark: '*',
    optionalMark: '(optional)',
  };

  _groupTemplate(item /* , readOnly */) {
    return (
      <div className={cf('group-title')}>
        <Caption>{item.text}</Caption>
      </div>
    );
  }

  _itemTemplate({ item, multiple, selected, readOnly }) {
    const type = multiple ? 'checkbox' : 'radio';
    return (
      <PickBox
        className={cf('pick-element')}
        readOnly={readOnly}
        type={type}
        compact
        controlled
        disabled={item.disabled}
        checked={selected}
        label={item.text}
      />
    );
  }

  renderOptions(group = {}) {
    const { items, id = '' } = group;
    const { model } = this.state;
    const { multiple, readOnly, columns, elementClassName, groupTemplate, itemTemplate, itemGutter = 0 } = this.props;

    const theGroupTemplate = groupTemplate || this._groupTemplate;
    const theItemTemplate = itemTemplate || this._itemTemplate;
    const outItems = [];

    if (group.text) {
      outItems.push(
        <div className={cf('group-wrapper')} key={`_group_${id}`}>
          {theGroupTemplate(group, readOnly)}
        </div>,
      );
    }

    const theItems = items || [];

    return theItems.reduce((acc, item, index) => {
      if (item.items) {
        const itemElements = this.renderOptions(item);
        acc = acc.concat(itemElements);
      } else {
        const selected = model.isSelected(item);
        const itemId = `${id ? `${id}_` : ''}${item.id}`;

        const handler = () => {
          if (readOnly) return;
          model.select(item);
        };

        let style;
        if (columns) {
          style = { width: '100%' };
          if (columns > 1) {
            const width = `calc(${100 / columns}% + ${itemGutter / columns}px - ${itemGutter}px)`;
            const marginRight = (index + 1) % columns === 0 ? 0 : itemGutter;
            style = { width, marginRight };
          }
        }

        acc.push(
          <SelectionItem key={itemId} data-id={`${item.text}_checkbox`} data-component="sg-item" style={style} className={elementClassName} onClick={handler}>
            {theItemTemplate({ item, multiple, selected, readOnly })}
          </SelectionItem>,
        );
      }
      return acc;
    }, outItems);
  }

  get value() {
    return this.selection();
  }

  set value(selectedValue) {
    const { model } = this.state;
    const selectedV = Array.isArray(selectedValue) ? selectedValue : [selectedValue];
    model.setSelectedByIds(selectedV);
  }

  shouldComponentUpdate(nextProps, nextState) {
    const toCompare = [
      'id',
      'label',
      'items',
      'onChange',
      'multiple',
      'textField',
      'valueField',
      'disabledField',
      'columns',
      'elementClassName',
      'itemTemplate',
      'groupTemplate',
      'itemGutter',
      'readOnly',
    ];

    const { model } = this.state;
    const { selectedValue } = nextProps;
    const selectedV = Array.isArray(selectedValue) ? selectedValue : [selectedValue];

    return !model._sameItemsSelected(selectedV) || !shallowCompare(nextProps, this.props, toCompare) || !shallowCompare(nextState, this.state, ['focused']);
  }

  selection() {
    const { model } = this.state;

    if (model) {
      return model.selection;
    }

    return [];
  }

  handleChange = () => {
    const selection = this.selection();
    const { onChange } = this.props;

    onChange && onChange(selection);
  };

  componentWillReceiveProps(nextProps) {
    let modelChange = false;

    if ('items' in nextProps) {
      const { items } = nextProps;

      if (items !== this.props.items) {
        modelChange = true;
        this.updateModel(nextProps);
      }
    }

    if ('selectedValue' in nextProps) {
      const { selectedValue } = nextProps;
      const selectedValueChanged = selectedValue !== this.props.selectedValue;

      if (selectedValueChanged || modelChange) {
        const { model } = this.state;
        const selectedV = Array.isArray(selectedValue) ? selectedValue : [selectedValue];

        model.setSelectedByIds(selectedV);
      }
    }
  }

  handleFocus = () => this.setState({ focused: true });

  handleBlur = () => this.setState({ focused: false });

  render() {
    const { model, focused } = this.state;
    const { className, label, id, errorMessage, 'data-component': dataComponent, required, optional, requiredMark, optionalMark, readOnly } = this.props;

    const valid = trim(errorMessage) === '';

    const theId = clsc(id, this.id);
    const errorMessageId = `${theId}-err-msg`;
    const theLabel = trim(label);

    const fieldProps = { required, optional, requiredMark, optionalMark };

    const labelC = theLabel ? (
      <label htmlFor={theId}>
        {theLabel} <FieldMark {...fieldProps} />
      </label>
    ) : null;

    return (
      <div
        data-component={dataComponent || 'selection-group'}
        onBlur={this.handleBlur}
        onFocus={this.handleFocus}
        data-id={theId}
        id={theId}
        className={cf('selection-group', { focused, readOnly }, g(className))}>
        {labelC}
        <div data-component="sg-elements" className={cf('pick-group')}>
          {this.renderOptions(model)}
        </div>
        {errorMessage && (
          <Validator id={errorMessageId} visible={!valid}>
            {errorMessage}
          </Validator>
        )}
      </div>
    );
  }
}
