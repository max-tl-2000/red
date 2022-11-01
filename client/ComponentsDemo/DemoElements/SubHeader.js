/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { cf } from './styles.scss';

export default class SubHeader extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    const { children } = this.props;

    return (
      <div className={cf('subHeaderGroup')}>
        <h5 className="subHeader">{children}</h5>
      </div>
    );
  }
}
