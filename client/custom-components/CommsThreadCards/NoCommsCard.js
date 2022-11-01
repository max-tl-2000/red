/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Icon, Card, Typography as T } from 'components';
import { cf, g } from './NoCommsCard.scss';

const NoCommsCard = ({ message, className }) => (
  <Card className={cf('card', g(className))}>
    <div className={cf('message')}>
      <T.SubHeader secondary>{message}</T.SubHeader>
    </div>
    <div className={cf('actions')}>
      <Icon name="phone" iconStyle="dark" disabled />
      <Icon name="message-text" iconStyle="dark" disabled />
      <Icon name="email" iconStyle="dark" disabled />
    </div>
  </Card>
);

export default NoCommsCard;
