/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { cf } from './application-steps.scss';

export const ApplicationSteps = () => (
  <ul className={cf('steps')}>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <img src="/graphics/ig-app-details.svg" />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('APPLICANT_DETAILS')}
      </T.SubHeader>
    </li>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <img src="/graphics/ig-payments.svg" />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('PAYMENT')}
      </T.SubHeader>
    </li>
    <li>
      <div>
        <span className={cf('step-tab')}>
          <img src="/graphics/ig-additional-info.svg" />
        </span>
      </div>
      <T.SubHeader secondary className={cf('step-info')}>
        {t('ADDITIONAL_INFORMATION')}
      </T.SubHeader>
    </li>
  </ul>
);
