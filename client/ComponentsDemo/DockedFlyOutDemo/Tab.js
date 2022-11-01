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
import { cf, g } from './Tabs.scss';

export default class Tab extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  static propTypes = {
    id: PropTypes.string,
    iconName: PropTypes.string,
  };

  render() {
    const {
      className,
      children,
      section, // eslint-disable-line
      iconName, // eslint-disable-line
      ...rest
    } = this.props;

    let { id } = this.props;

    // use the provided id if provided or the default otherwise
    id = clsc(id, this.id);

    return (
      <div data-component="tab" id={id} className={cf('tab', g(className))} {...rest}>
        {children}
      </div>
    );
  }
}
