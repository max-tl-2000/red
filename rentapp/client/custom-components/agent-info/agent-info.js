/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { Avatar, Typography as T } from 'components';
import { cf, g } from './agent-info.scss';

export const AgentInfo = ({ agent }) => (
  <div className={cf('agent-info')}>
    <Avatar className={cf(g('avatarSize'))} userName={agent.fullName} src={agent.avatar} />
    <div className={cf('contact-info')}>
      <div>
        <T.Text>{agent.fullName}</T.Text>
        <T.Text secondary>{agent.title}</T.Text>
      </div>
      <div>
        <T.Text>{agent.phone}</T.Text>
        <T.Text>{agent.email}</T.Text>
      </div>
    </div>
  </div>
);

AgentInfo.propTypes = {
  agent: PropTypes.shape({
    fullName: PropTypes.string,
    title: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
    avatar: PropTypes.string,
  }),
};
