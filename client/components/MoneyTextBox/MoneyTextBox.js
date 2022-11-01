/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { isNumber } from 'helpers/type-of';
import nullish from 'helpers/nullish';
import TextBox from '../TextBox/TextBox';
import { convertToFloat, ParseableNumber } from '../../../common/money-formatter';
import { isNavigationOrEntryKey } from '../../../common/helpers/keys';
export default class MoneyTextBox extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    moneySign: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // for now accept string to support legacy code
  };

  static defaultProps = {
    moneySign: '$',
    showClear: true, // make it true by default
  };

  handleKeyPress = e => {
    if (isNavigationOrEntryKey(e.charCode)) {
      return; // do not prevent the use of navigation keys, backspace or enter
    }
    const charCode = String.fromCharCode(e.charCode);
    if (!this.isValueAllowed(charCode)) {
      e.preventDefault();
    }
  };

  isValueAllowed = char => !!char.match(/[+.,0-9]/);

  handleChange = ({ value }) => {
    const { onChange } = this.props;
    if (onChange) {
      if (nullish(value)) {
        onChange({ value });
        return;
      }
      let parsedVal = convertToFloat(value);
      if (isNaN(parsedVal)) {
        parsedVal = null;
      }
      onChange({ value: parsedVal });
    }
  };

  get value() {
    const val = this.txt.value;
    if (nullish(val)) {
      return val;
    }
    return convertToFloat(val);
  }

  set value(val) {
    if (nullish(val) || isNaN(val)) {
      this.txt.value = '';
      return;
    }

    if (!isNumber(val)) {
      throw new TypeError('MoneyTextBox value should be a number');
    }

    this.txt.value = val;
  }

  handleBlur = (e, { value }) => {
    const val = ParseableNumber.create(value);
    const { onChange, onBlur } = this.props;

    this.txt.value = val.formatted;

    onBlur && onBlur(e, { value: val.parsedValue });

    if (!val.isEqual(this._lastValue)) {
      onChange && onChange({ value: isNaN(val.parsedValue) ? '' : val.parsedValue });
    }

    this._lastValue = val;
  };

  componentWillUnmount() {
    this._lastValue = null;
  }

  render() {
    const {
      id,
      moneySign,
      showClear,
      value,
      onBlur, // eslint-disable-line
      onChange, // eslint-disable-line
      ...rest
    } = this.props;

    // use the provided id if provided or the default otherwise
    const theId = clsc(id, this.id);

    const val = ParseableNumber.create(value);

    return (
      <TextBox
        ref={ref => (this.txt = ref)}
        id={theId}
        value={val.formatted}
        onBlur={this.handleBlur}
        onKeyPress={this.handleKeyPress}
        textAffordance={moneySign}
        showClear={showClear}
        {...rest}
      />
    );
  }
}
