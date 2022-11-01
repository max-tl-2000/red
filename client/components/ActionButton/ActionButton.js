/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component, Children, cloneElement } from 'react';
import generateId from 'helpers/generateId';
import trim from 'helpers/trim';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';

import { cf, g } from './ActionButton.scss';

const iconType = (<Icon name="pause" />).type;

const { bool, string } = PropTypes;

export default class ActionButton extends Component {
  static propTypes = {
    useWaves: bool,
    wavesStyle: string,
    size: string,
  };

  static defaultProps = {
    useWaves: true,
    wavesStyle: '',
    size: 'small',
  };

  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    const { className, size, ...rest } = this.props;

    const children = Children.map(this.props.children, child => {
      if (child.type === iconType) {
        return cloneElement(child, {
          ...child.props,
          className: cf('action-icon', g(child.props.className)),
          iconStyle: typeof child.props.iconStyle === 'undefined' ? 'light' : child.props.iconStyle,
        });
      }
      return child;
    });

    let theSize = size;

    if (!theSize) {
      theSize = 'small';
    }

    const cNames = cf(
      {
        'action-button': true,
        small: theSize === 'small',
      },
      g({
        [className]: !!trim(className),
        'btn-floating': true,
        'btn-large': theSize === 'large',
      }),
    );

    return (
      <Button {...rest} className={cNames} data-component="action-button">
        <div className={cf('wrapper')}>{children}</div>
      </Button>
    );
  }
}
