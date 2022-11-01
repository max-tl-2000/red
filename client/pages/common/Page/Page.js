/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import { cf, g } from './Page.scss';
import Footer from '../Footer/Footer';

export default class Page extends Component {
  render() {
    const { children, className, outerClassName } = this.props;

    return (
      <div className={outerClassName}>
        <div className={cf('Page', g(className))}>{children}</div>
        <Footer />
      </div>
    );
  }
}
