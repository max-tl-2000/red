/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import ListItem from '../List/ListItem';
import MainSection from '../List/MainSection';
import AvatarSection from '../List/AvatarSection';
import Text from '../Typography/Text';
import Icon from '../Icon/Icon';
import { cf } from './MenuItem.scss';

export default class MenuItem extends Component {
  static propTypes = {
    text: PropTypes.string.isRequired,
    className: PropTypes.string,
    onClick: PropTypes.func,
    disabled: PropTypes.bool,
    icon: PropTypes.object,
    iconName: PropTypes.string,
    action: PropTypes.string,
  };

  static defaultProps = {
    disabled: false,
  };

  handleClick = () => {
    const { onClick, disabled } = this.props;
    if (disabled) {
      return;
    }

    onClick && onClick();
  };

  render() {
    const { className, icon, iconName, text, action, disabled, ...rest } = this.props;
    let theIcon = icon;
    if (!theIcon) {
      if (iconName) {
        theIcon = <Icon name={iconName} />;
      }
    }
    return (
      <ListItem
        className={className}
        data-menu-item={true}
        onClick={this.handleClick}
        disabled={disabled}
        data-disabled={disabled}
        data-action={action}
        {...rest}>
        {theIcon && <AvatarSection>{theIcon}</AvatarSection>}
        <MainSection>
          <Text>{text}</Text>
          <div className={cf('status')}>{this.props.children}</div>
        </MainSection>
      </ListItem>
    );
  }
}
