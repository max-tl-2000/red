/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography as T, Button } from 'components';
import { t } from 'i18next';
import { cf } from './ReviewDuplicateBanner.scss';

const ReviewDuplicateBanner = ({ onReviewMatchRequest }) => (
  <div className={cf('banner')} data-id="possibleDuplicateBanner">
    <T.Text highlight data-id="possibleDuplicateTxt">
      {t('STRONG_MATCH_DASHBOARD_BANNER_TEXT')}
    </T.Text>
    <Button id="reviewMatchesBtn" btnRole={'primary'} type={'raised'} label={t('REVIEW_MATCHES_BUTTON')} onClick={onReviewMatchRequest} />
  </div>
);

export default ReviewDuplicateBanner;
