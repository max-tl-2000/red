/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { cf, g } from './IconButton.scss';
import Icon, { isIconAvailable } from '../Icon/Icon';
import Button from '../Button/Button';

export default class IconButton extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    id: PropTypes.string,
    disabled: PropTypes.bool,
    className: PropTypes.any,
    iconName: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
    iconStyle: PropTypes.oneOf(['light', 'dark']),
  };

  static defaultProps = {
    iconName: '',
    iconStyle: 'dark',
  };

  render() {
    const {
      iconName,
      className,
      iconStyle,
      disabled,
      noHover,
      compact,
      iconProps,
      dataId,
      badgeIcon,
      badgeClassName,
      badgeIconViewBox,
      ...btnProps
    } = this.props;

    const useLight = iconStyle === 'light' && !disabled;

    const cNames = cf(
      'icon-button',
      {
        light: useLight,
        noHover,
        compact,
        loading: btnProps.loading,
      },
      g(className),
    );

    let { children } = this.props;

    if (!children) {
      if (iconName && typeof iconName === 'string') {
        if (!isIconAvailable(iconName)) {
          children = <i className={cf('icon', g('material-icons'))}>{iconName}</i>;
        } else {
          children = <Icon name={iconName} iconStyle={iconStyle} {...iconProps} />;
        }
      }

      if (typeof iconName === 'function') {
        children = iconName();
      }
    }

    return (
      <Button className={cNames} type="wrapper" disabled={disabled} loaderStyle={iconStyle} data-component="icon-button" data-id={dataId} {...btnProps}>
        <span className={cf('wrapper')}>{children}</span>
        {!!badgeIcon && <Icon name={badgeIcon} className={badgeClassName} viewBox={badgeIconViewBox} />}
      </Button>
    );
  }
}
