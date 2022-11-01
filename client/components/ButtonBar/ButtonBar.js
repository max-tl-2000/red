/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import { cf, g } from './ButtonBar.scss';
import Button from '../Button/Button';
import SelectionGroup from '../SelectionGroup/SelectionGroup';

export default class ButtonBar extends Component {
  renderOptions = ({ item, selected }) => {
    const checked = selected;
    const { disabled } = this.props;

    return (
      <Button type="wrapper" data-checked={checked} disabled={item.disabled || disabled} className={cf('pick-element', { checked })} id={item.id}>
        <span className={cf('inner-wrapper')}>
          <span>{item.text}</span>
        </span>
      </Button>
    );
  };

  get value() {
    return this.selGroup.value;
  }

  set value(selectedValue) {
    this.selGroup.value = selectedValue;
  }

  selection = () => this.selGroup.selection();

  storeRef = ref => {
    this.selGroup = ref;
  };

  render() {
    const { className, readOnly, ...rest } = this.props;
    return (
      <SelectionGroup
        className={cf('button-bar', g(className))}
        readOnly={readOnly}
        ref={this.storeRef}
        {...rest}
        data-component="button-bar"
        itemTemplate={this.renderOptions}
      />
    );
  }
}
