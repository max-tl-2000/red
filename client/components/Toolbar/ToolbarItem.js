/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Toolbar.scss';

const ToolbarItem = ({ className, stretched, children, ...props }) => (
  <div data-component="toolbar-item" className={cf('toolbar-item', { stretched, normal: !stretched }, g(className))} {...props}>
    <div>{children}</div>
  </div>
);

export default ToolbarItem;
