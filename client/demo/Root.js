/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observer } from 'mobx-react';
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';

import MobxDevTools from 'mobx-react-devtools';
import demoRoutes from '../../resources/generated-routes';

@observer
class Root extends Component {
  render() {
    const { history } = this.props;

    return (
      <div>
        {demoRoutes(history)}
        {__MOBX_DEVTOOLS__ && <MobxDevTools />}
      </div>
    );
  }
}

export default hot(module)(Root);
