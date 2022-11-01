/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Typography } from 'components';
import { cf, g } from './error-block.scss';

const { Title, SubHeader, Text } = Typography;

const ErrorBlock = ({ error: { title, message, token } = {}, className } = {}) => (
  <div className={cf('container', g(className))}>
    <div className={cf('picto')} />
    {title && <Title className={cf('title')}>{t(title)}</Title>}
    {message && <SubHeader className={cf('msg')}>{t(message)}</SubHeader>}
    {token && (
      <Text inline bold>
        {t(token)}
      </Text>
    )}
  </div>
);

export default ErrorBlock;
