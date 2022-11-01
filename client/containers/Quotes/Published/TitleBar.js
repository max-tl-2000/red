/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Avatar } from 'components';
import { cf } from './QuoteResult.scss';

export default function TitleBar({ property, agent }) {
  return (
    <div className={cf('header')}>
      <div className={cf('branding')}>
        <div className={cf('brand')}>{property.displayName}</div>
      </div>
      <div className={cf('contact-container')}>
        <div className={cf('contact')}>
          <div className={cf('contact-avatar')}>
            <Avatar userName={agent.fullName} src={agent.avatarUrl} />
          </div>
          <div className={cf('contact-info')}>
            <div>
              <span className={cf('contact-name')}>{agent.fullName}</span>
              <span className={cf('contact-title')}>{agent.title}</span>
            </div>
            <div>
              <span className={cf('contact-phone')}>{agent.phone}</span>
              {agent && agent.email && <span className={cf('contact-separator')}> | </span>}
              <span className={cf('contact-email')}>{agent.email}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
