/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import ActionButton from '../ActionButton/ActionButton';
import Icon from '../Icon/Icon';
import { cf, g } from './ActionMenuItem.scss';

export default class ActionMenuItem extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    text: PropTypes.string,
    icon: PropTypes.string,
    disabled: PropTypes.bool,
  };

  handleClick = () => {
    const { onClick, disabled } = this.props;

    if (disabled) {
      return;
    }

    onClick && onClick();
  };

  render() {
    const { className, text, icon, disabled, rightAligned } = this.props;

    return (
      <div className={cf('menu-item', { disabled, rightAligned }, g(className))} onClick={this.handleClick}>
        {text && (
          <p className={cf('text')}>
            <span>{text}</span>
          </p>
        )}
        <div className={cf('icon')}>
          <ActionButton btnRole={'secondary'}>
            <Icon name={icon} iconStyle="dark" className={cf('action-button')} />
          </ActionButton>
        </div>
      </div>
    );
  }
}
