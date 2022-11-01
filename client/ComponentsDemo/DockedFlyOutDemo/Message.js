/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { cf } from './Communications.scss';

const { Text } = Typography;

const Message = ({ owner = false, content, userName, time }) => (
  <div className={cf('message', { owner })}>
    <div className={cf('meta-section')}>
      <div>
        <Text secondary className={cf('username')}>
          {userName}
        </Text>
        <Text secondary className={cf('time')}>
          {time}
        </Text>
      </div>
    </div>
    <div className={cf('body-section')}>
      <div>
        <Text>{content}</Text>
      </div>
    </div>
  </div>
);

export default Message;
