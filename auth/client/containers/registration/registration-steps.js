/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Icon, Typography as T } from 'components';
import { t } from 'i18next';
import { cf } from './registration-steps.scss';

export const RegistrationSteps = () => (
  <ul className={cf('steps')}>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <Icon name="archive" className={cf('icon')} />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('RENT_PAYMENTS')}
      </T.SubHeader>
    </li>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <Icon name="wrench" className={cf('icon')} />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('MAINTENANCE_REQUEST')}
      </T.SubHeader>
    </li>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <Icon name="people" className={cf('icon')} />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('COMMUNITIES')}
      </T.SubHeader>
    </li>
  </ul>
);
