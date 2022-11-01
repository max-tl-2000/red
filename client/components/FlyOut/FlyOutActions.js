/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer } from 'mobx-react';
import { cf, g } from './FlyOut.scss';

const FlyOutActions = ({ children, className, ...props }) => (
  <div data-component="flyout-actions" className={cf('flyout-actions', g(className))} {...props}>
    {children}
  </div>
);

export default observer(FlyOutActions);
