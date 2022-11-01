/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { cf, g } from './styles.scss';

export default class DemoPage extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    /* esfmt-ignore-start */
    const { title, className, children, style } = this.props;
    /* esfmt-ignore-end */

    const cName = cf('demo-page', g(className));

    return (
      <div className={cName} style={style}>
        <h2 className="display1" style={{ marginBottom: '1rem' }}>
          {title}
        </h2>
        {children}
      </div>
    );
  }
}
