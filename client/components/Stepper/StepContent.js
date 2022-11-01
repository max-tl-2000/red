/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Stepper.scss';

const StepContent = ({ className, container, children, ...rest }) => (
  <div className={cf('step-content', { container }, g(className))} {...rest}>
    {children}
  </div>
);

export default StepContent;
