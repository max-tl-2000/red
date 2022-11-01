/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { formatTimestamp } from 'helpers/date-utils';
import { cf } from './SmsMessage.scss';

const { Text } = Typography;

const Message = ({ isOwner, time, content, sentBy, timezone }) => (
  <div>
    <div className={cf('message', { owner: isOwner })}>
      <div className={cf('meta-section')}>
        <Text secondary inline className={cf('senderName')}>
          {sentBy && `${sentBy.fullName} `}
        </Text>
      </div>
      <div className={cf('body-section')}>
        <div>
          <Text lighter={isOwner}>{content}</Text>
        </div>
      </div>
      <div className={cf('meta-section')}>
        <Text secondary inline className={cf('time')}>
          {formatTimestamp(time, { timezone })}
        </Text>
      </div>
    </div>
  </div>
);
export default Message;
