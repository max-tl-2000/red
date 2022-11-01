/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';

import { Typography, Icon } from 'components';
import { t } from 'i18next';
import { cf } from './DefaultWarning.scss';
import { toMoment } from '../../../common/helpers/moment-utils';
const { Text } = Typography;

// TODO: ask avantica to make sure we pass the timezone
export const DefaultWarning = ({ message, applicantName, date, timezone }) => (
  <div className={cf('message-block')} key={`key-${Date.now()}`}>
    <Icon name="information" className={cf('icon')} />
    <Text className={cf('message')}>{t(message, { name: applicantName })}</Text>
    <Text className={cf('date')}>{toMoment(date, { timezone }).calendar()}</Text>
  </div>
);
