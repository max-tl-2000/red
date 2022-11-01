/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './Form.scss';
import Text from '../Typography/Text';
import Field from './Field';

export default function FormSummary({ className, title, messages = [], ...props }) {
  if (!messages || messages.length === 0) {
    return <noscript />;
  }
  return (
    <Field className={cf('form-summary', g(className))} {...props}>
      {title && (
        <Text bold error>
          {title}
        </Text>
      )}
      {messages.length > 0 && (
        <ul>
          {messages.map((message, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={idx}>
              <Text error> - {message}</Text>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
