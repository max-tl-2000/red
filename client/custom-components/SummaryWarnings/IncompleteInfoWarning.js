/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography, Icon } from 'components';
import { t } from 'i18next';
import { cf } from './Warning.scss';
const { Text, Link } = Typography;

export const IncompleteInfoWarning = ({ content, handleOpenManageParty }) => (
  <div className={cf('warning')} key={`key-${Date.now()}`}>
    <Icon name="alert" className={cf('icon')} />
    <Text className={cf('message')}>
      {content}
      {` ${t('GO_TO_PAGE')}`}
      <Link className={cf('link')} underline onClick={handleOpenManageParty}>
        {t('MANAGE_PARTY')}
      </Link>
      {` ${t('PAGE')}`}
    </Text>
  </div>
);
