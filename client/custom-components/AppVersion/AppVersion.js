/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import cfg from 'helpers/cfg';
import { Chip } from 'components';
import { connect } from 'react-redux';
import { cf } from './AppVersion.scss';

const AppVersion = ({ currentUser }) => {
  const leftAligned = !currentUser;
  return ['prod', 'demo', 'university'].includes(cfg('cloudEnv')) ? null : (
    <Chip className={cf('AppVersion', { leftAligned })} text={`${cfg('buildVersion')}`} />
  );
};

export default connect(state => ({
  currentUser: state.auth.user,
}))(AppVersion);
