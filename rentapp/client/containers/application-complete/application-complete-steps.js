/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { cf } from './application-complete-steps.scss';

export const ApplicationCompleteSteps = () => (
  <ul className={cf('steps')}>
    <li className={cf('active')}>
      <div>
        <span className={cf('step-tab')}>
          <img src="/graphics/ig-app-submitted.svg" />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('YOUR_APPLICATION_SUBMITTED')}
      </T.SubHeader>
    </li>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <img src="/graphics/ig-your-app-submitted.svg" />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('ALL_APPLICATIONS_SUBMITTED')}
      </T.SubHeader>
    </li>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <img src="/graphics/ig-app-review.svg" />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('PROPERTY_REVIEWS_APPLICATIONS')}
      </T.SubHeader>
    </li>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <img src="/graphics/ig-lease-signing.svg" />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('LEASE_SIGNATURES')}
      </T.SubHeader>
    </li>
  </ul>
);
