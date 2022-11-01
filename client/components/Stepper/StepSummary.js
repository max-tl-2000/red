/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Stepper.scss';

const StepSummary = ({ className, children, ...rest }) => (
  <div data-component="step-summary" className={cf('step-summary', g(className))} {...rest}>
    {children}
  </div>
);

export default StepSummary;