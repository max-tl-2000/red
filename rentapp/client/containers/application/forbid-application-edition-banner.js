/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { cf } from './application.scss';

export const ForbidEditionBanner = () => (
  <div className={cf('message-block')}>
    <div className={cf('text')}>
      <T.Text secondary>{t('CANNOT_EDIT_APPLICATION_LINE1')}</T.Text>
      <T.Text secondary>{t('CANNOT_EDIT_APPLICATION_LINE2')}</T.Text>
    </div>
  </div>
);
