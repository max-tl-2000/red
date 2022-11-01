/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Chip } from 'components';
import { connect } from 'react-redux';
import { t } from 'i18next';
import cfg from '../../helpers/cfg';
import { cf } from './SendGridSandboxEnabledWidget.scss';

const SendGridSandboxEnabledWidget = ({ currentUser }) => {
  const shouldShowWidget = !['prod', 'demo', 'university'].includes(cfg('cloudEnv')) && currentUser?.tenantSendGridSandboxEnabled;
  return shouldShowWidget ? <Chip className={cf('SendGridSandboxEnabledWidget')} text={t('SENDGRID_SB')} /> : null;
};

export default connect(state => ({
  currentUser: state.auth.user,
}))(SendGridSandboxEnabledWidget);
