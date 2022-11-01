/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { t } from 'i18next';
import { cf } from './default-app-footer.scss';
import { AppLinkIds } from '../../../../common/enums/messageTypes';
import { now } from '../../../../common/helpers/moment-utils';

const { Caption } = Typography;
const renderLink = ({ text, divider, onClick }) => (
  <Caption secondary onClick={onClick}>
    {text}
    {divider && <span>|</span>}
  </Caption>
);

export const DefaultAppFooter = ({ redirectTo }) => (
  <div className={cf('footer')}>
    <div className={cf('inline')}>
      {renderLink({
        text: t('TERMS_AND_CONDITIONS'),
        divider: true,
        onClick: () => redirectTo(AppLinkIds.TERMS_AND_CONDITIONS),
      })}{' '}
      {/* TODO: This links will came from somewhere else */}
      {renderLink({
        text: t('PRIVACY_POLICY'),
        divider: true,
        onClick: () => redirectTo(AppLinkIds.PRIVACY_POLICY),
      })}
      {renderLink({
        text: t('CONTACT_US'),
        onClick: () => redirectTo(AppLinkIds.CONTACT_US),
      })}
    </div>
    <Caption secondary className={cf('copyright')}>
      {t('COPYRIGHT', { year: now().year() })}
    </Caption>
  </div>
);
