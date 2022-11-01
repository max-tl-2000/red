/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf } from './TimeDuration.scss';

export default function TimeDuration({ value, unit = 'month' }) {
  const unitName = (value > 1 && `${unit}s`) || unit;
  return (
    <span>
      <span data-component="time-duration-value" className={cf('value')}>
        {value}
      </span>
      <span data-component="time-duration-unit" className={cf('unit')}>
        {unitName}
      </span>
    </span>
  );
}
