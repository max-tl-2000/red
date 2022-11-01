/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import shallowCompare from 'helpers/shallowCompare';
import React, { Component } from 'react';
import Field from '../Form/Field';
import IconButton from '../IconButton/IconButton';
import { cf } from './TextFieldWrapper.scss';

export default class TextFieldWrapper extends Component {
  shouldComponentUpdate(nextProps) {
    const props = this.props;
    const propsToCheck = [
      'renderComponent',
      'onNewClick',
      'errorMessage',
      'value',
      'label',
      'autoFocus',
      'showAdd',
      'onFocus',
      'placeholder',
      'onBlur',
      'onChange',
    ];

    const shouldUpdate = !shallowCompare(props, nextProps, propsToCheck);

    return shouldUpdate;
  }

  render() {
    const { renderComponent, showAdd, onNewClick, last, item, ...rest } = this.props;
    return (
      <Field vAlign="top" className={cf('text-wrapper', { 'has-label': rest.label, last })}>
        {renderComponent(rest, item)}
        {showAdd && <IconButton data-part="add-trigger" className={cf('btn')} iconName="plus" onClick={onNewClick} />}
      </Field>
    );
  }
}
