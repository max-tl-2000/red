/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Caption from '../Typography/Caption';
import { cf } from './FieldMark.scss';

const FieldMark = ({ optional, required, optionalMark, requiredMark }) => {
  let mark;

  if (optional && required) {
    throw new Error('"required" and "optional" are exclusive only one of them can be true at a given time');
  }

  if (optional && optionalMark) {
    mark =
      typeof optionalMark === 'string' ? (
        <Caption noDefaultColor inline>
          {optionalMark}
        </Caption>
      ) : (
        optionalMark
      );
  }

  if (required && requiredMark) {
    mark =
      typeof requiredMark === 'string' ? (
        <Caption noDefaultColor inline>
          {requiredMark}
        </Caption>
      ) : (
        requiredMark
      );
  }

  return mark ? <span className={cf('mark')}>{mark}</span> : null;
};

export default FieldMark;
