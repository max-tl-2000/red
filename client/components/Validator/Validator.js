/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { toSentenceCase } from 'helpers/capitalize';
import clsc from 'helpers/coalescy';
import { cf } from './Validator.scss';
import Icon from '../Icon/Icon';

export default function Validator(props) {
  const { errorMessage, visible, className = 'error', children, iconName = 'alert', forceSentenceCase = true, ...rest } = props;

  let errorContent = children || errorMessage;

  if (typeof errorContent === 'string') {
    errorContent = forceSentenceCase ? toSentenceCase(errorContent) : errorContent;
  }

  const statusClasses = cf(
    'validator',
    {
      on: clsc(visible, errorContent),
    },
    className,
  );

  return (
    <div data-component="validator" className={statusClasses} {...rest}>
      {errorContent}
      {iconName && (
        <div className={cf('icon-wrapper')}>
          <Icon name={iconName} className={cf('error-icon')} />
        </div>
      )}
    </div>
  );
}
