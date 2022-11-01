/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Typography } from 'components';
import { cf } from './EmergencyMessageInfo.scss';
import { InformationOutline } from '../../../red-icons/index';

const { Text } = Typography;

const EmergencyMessageInfo = () => (
  <div className={cf('wrapper')}>
    <InformationOutline className={cf('icon')} />
    <Text primary>{t('EMERGENCY_MESSAGE_INFO')}</Text>
  </div>
);

export default EmergencyMessageInfo;
