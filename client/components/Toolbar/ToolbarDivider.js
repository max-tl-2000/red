/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Toolbar.scss';

const ToolbarDivider = ({ className, ...props }) => <div data-component="toolbar-divider" className={cf('toolbar-divider', g(className))} {...props} />;

export default ToolbarDivider;
