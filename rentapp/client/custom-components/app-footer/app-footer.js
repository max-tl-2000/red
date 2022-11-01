/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { t } from 'i18next';
import { windowOpen } from 'helpers/win-open';
import { observer, inject } from 'mobx-react';
import { AppLinkIdUrls } from '../../../../common/enums/messageTypes';
import { prefixUrlWithProtocol } from '../../../../common/helpers/resolve-url';
import { cf, g } from './app-footer.scss';
import { now } from '../../../../common/helpers/moment-utils';

const { Caption } = Typography;

const renderLink = ({ text, divider, onClick }) => (
  <Caption secondary onClick={onClick}>
    {text}
    {divider && <span>|</span>}
  </Caption>
);

export const AppFooter = inject('application')(
  observer(({ application, className }) => {
    const contactUsUrl = prefixUrlWithProtocol(application.contactUsLink);
    return (
      <div className={cf('footer', g(className))}>
        <div className={cf('inline')}>
          {renderLink({
            text: t('TERMS_AND_CONDITIONS'),
            divider: true,
            onClick: () => windowOpen(AppLinkIdUrls.TERMS_AND_CONDITIONS_ID),
          })}
          {renderLink({
            text: t('PRIVACY_POLICY'),
            divider: true,
            onClick: () => windowOpen(AppLinkIdUrls.PRIVACY_POLICY_ID),
          })}
          {renderLink({
            text: t('CONTACT_US'),
            onClick: () => contactUsUrl && windowOpen(contactUsUrl),
          })}
        </div>
        <Caption secondary className={cf('copyright')}>
          {t('COPYRIGHT', { year: now().year() })}
        </Caption>
      </div>
    );
  }),
);
