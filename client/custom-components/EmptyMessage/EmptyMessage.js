/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Text from 'components/Typography/Text';
import { cf, g } from './EmptyMessage.scss';

const EmptyMessage = ({ children, message, className, dataId = '', ...rest }) => (
  <div data-component="empty-message" className={cf('emptyMessage', g(className))} {...rest}>
    {message && (
      <Text data-id={dataId} secondary>
        {message}
      </Text>
    )}
    {children}
  </div>
);

export default EmptyMessage;
