/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography, Icon } from 'components';
import { t } from 'i18next';
import cfg from 'helpers/cfg';
import { windowOpen } from 'helpers/win-open';
import { cf } from './UnitReservedWarning.scss';
import { toSentenceCase } from '../../helpers/capitalize';
const { Text, Link } = Typography;

export const LeaseStartWarning = ({ content }) => (
  <div className={cf('unit-reserved-warning')} key={`key-${Date.now()}`}>
    <Icon name="alert" className={cf('icon')} />
    <Text className={cf('message')}>
      {content}
      <Link className={cf('link')} onClick={() => windowOpen(cfg('zendeskConfig.learnMoreLeaseStartPreceedUnitAvailability'))} underline>
        {toSentenceCase(t('LEARN_MORE'))}
      </Link>
    </Text>
  </div>
);
