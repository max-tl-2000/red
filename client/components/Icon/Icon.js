/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { cf, g } from './icon.scss';
import svgs, { icons } from './svgs';

export { icons };

export function isIconAvailable(name) {
  return !!svgs[name];
}

export default class Icon extends Component {
  static propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    name(props, propName, componentName) { // eslint-disable-line
      const propVal = props[propName];
      if (!icons.includes(propVal)) {
        return new Error(`"${propVal}" is not a valid value for the "name" prop in "${componentName}". Validation failed`);
      }
    },
    iconStyle: PropTypes.oneOf(['light', 'dark']),
    style: PropTypes.object,
  };

  render() {
    const { className, name, disabled, iconStyle, style, id, viewBox } = this.props;

    const iconInHash = svgs[name];
    const iconName = iconInHash ? name : 'missing-icon';

    const theClasses = cf(
      'icon',
      {
        light: iconStyle === 'light',
        disabled,
      },
      g(className),
    );

    return (
      <section id={id} data-red-icon="true" name={name} data-component="icon" className={theClasses} style={style}>
        <svg width="24" height="24" viewBox={viewBox || '0 0 24 24'} xmlns="http://www.w3.org/2000/svg">
          <g id={iconName} dangerouslySetInnerHTML={{ __html: svgs[iconName] }} />
        </svg>
      </section>
    );
  }
}
