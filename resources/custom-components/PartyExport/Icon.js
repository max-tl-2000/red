/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import sass from 'node-sass';
import path from 'path';
import svgs, { icons } from './svgs.js';

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

  static styles = [sass.renderSync({ file: path.resolve(__dirname, './Icon.scss') }).css.toString()];

  render() {
    const { className, name, disabled, iconStyle, style, id } = this.props;
    const iconInHash = svgs[name];
    const iconName = iconInHash ? name : 'missing-icon';

    const disabledClass = disabled ? 'disabled' : '';
    const theClasses = `icon ${iconStyle} ${className} ${disabledClass}`;

    return (
      <div id={id} data-red-icon="true" data-component="icon" className={theClasses} style={style}>
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <g id={iconName} dangerouslySetInnerHTML={{ __html: svgs[iconName] }} />
        </svg>
      </div>
    );
  }
}
