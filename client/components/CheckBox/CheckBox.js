/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PickBox from '../PickBox/PickBox';

export default class CheckBox extends Component {
  get value() {
    return this.refs.pickBox.value;
  }

  set value(value) {
    this.refs.pickBox.value = value;
  }

  render() {
    const { type, ...props } = this.props;
    const pickBoxType = type || 'checkbox';
    return <PickBox data-component="checkbox" ref="pickBox" type={pickBoxType} {...props} />;
  }
}
