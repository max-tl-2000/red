/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { cf, g } from './List.scss';

// since we need to get a ref to this component
// we cannot make it a stateless component
// eslint-disable-next-line react/prefer-stateless-function
export default class List extends Component {
  render() {
    const { className, children, ...props } = this.props;
    return (
      <div data-component="list" className={cf('list', g(className))} {...props}>
        {children}
      </div>
    );
  }
}
