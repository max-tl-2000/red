/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Typography as T } from 'components';
import { cf } from './rentapp-bar.scss';

export const ApplyOnBehalfOf = ({ applicantName, smallLayout }) =>
  applicantName && (
    <T.SubHeader lighter className={cf('apply', { smallLayout })}>
      {t('APPLY_ON_BEHALF_OF', { applicantName: applicantName.firstName })}
    </T.SubHeader>
  );
