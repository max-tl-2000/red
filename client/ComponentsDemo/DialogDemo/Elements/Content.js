/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import InnerComponent from './InnerComponent';
import Ticker from './Ticker';

export default class Content extends Component {
  constructor(...args) {
    super(...args);
    console.log('Content constructor');
  }

  componentDidMount() {
    console.log('mounting Content');
  }

  componentWillUnmount() {
    console.log('unmounting Content');
  }

  render() {
    return (
      <div>
        <InnerComponent>
          <div>
            <p>Hello world from an inner component</p>
          </div>
          <Ticker />
        </InnerComponent>
      </div>
    );
  }
}
