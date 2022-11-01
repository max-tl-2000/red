/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Typography as T } from 'components';
import { DemoPage } from '../DemoElements';

export default class MyComponent extends Component { // eslint-disable-line
  render() {
    return (
      <DemoPage title="Not Found">
        <T.Text>The page was not found</T.Text>
        <T.Text>Please choose one of the components on the left to check its documentation</T.Text>
      </DemoPage>
    );
  }
}
