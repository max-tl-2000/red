/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { observable } from 'mobx';

import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import trim from 'helpers/trim';
import TextBox from '../TextBox/TextBox';
import PhoneModel from './PhoneModel';

@observer
export default class PhoneTextBox extends Component {
  @observable
  txtFocused;

  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.phoneModel = PhoneModel.create(props.value);
    this.state = {};
  }

  static propTypes = {
    id: PropTypes.string,
  };

  componentWillReceiveProps(nextProps) {
    if ('value' in nextProps) {
      const newModel = PhoneModel.create(nextProps.value);
      if (!this.phoneModel.isEqual(newModel)) {
        this.phoneModel.setValue(newModel.qualifiedValue);
      }
    }
  }

  handleFocus = e => {
    const { onFocus } = this.props;
    this.txtFocused = true;
    onFocus && onFocus(e);
  };

  handleBlur = e => {
    const { onBlur } = this.props;
    this.txtFocused = false;
    onBlur && onBlur(e);
  };

  handleChange = () => {
    const value = trim(this.phoneRef.value);

    const tempModel = PhoneModel.create(value);

    if (!this.phoneModel.isEqual(tempModel)) {
      this.phoneModel.setValue(tempModel.qualifiedValue);
      const { onChange } = this.props;

      const qualifiedValue = this.phoneModel.qualifiedValue;
      onChange && onChange({ value: qualifiedValue });
    }
  };

  storePhoneRef = ref => {
    this.phoneRef = ref;
  };

  focus() {
    this.phoneRef.focus();
  }

  get value() {
    return this.phoneRef.value;
  }

  render() {
    const {
      id,
      className,
      dataId,
      value, // eslint-disable-line
      // this will be fired manually
      onChange, // eslint-disable-line
      onBlur, // eslint-disable-line
      ...rest
    } = this.props;

    // use the provided id if provided or the default otherwise
    const theId = clsc(id, this.id);

    const { txtFocused } = this;
    const valProp = {};

    // only update the value if the input is not focused
    if (!txtFocused) {
      valProp.value = this.phoneModel.displayValue;
    }

    return (
      <TextBox
        data-component="phone-textbox"
        showClear
        ref={this.storePhoneRef}
        {...rest}
        {...valProp}
        className={className}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
        id={theId}
        dataId={dataId}
        onChange={this.handleChange}
      />
    );
  }
}
