/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer, inject } from 'mobx-react';
import { AppBar, AppBarActions, IconButton } from 'components';
import { t } from 'i18next';
import { ApplyOnBehalfOf } from './apply-on-behalf-of';
import { cf, g } from './rentapp-bar.scss';

import * as T from '../../../../client/components/Typography/Typography';

export const RentAppBar = inject(
  'application',
  'screen',
  'auth',
)(
  observer(({ title, propertyName, className, appBarActions, application, screen, auth }) => {
    const { isXSmall } = screen;
    const renderAppBarActions = () => {
      const applicantName = application.getApplicantDisplayName();

      return (
        <AppBarActions>
          {auth.isImpersonation && <ApplyOnBehalfOf smallLayout={isXSmall} applicantName={applicantName} />}
          {appBarActions}
        </AppBarActions>
      );
    };

    const getTitlePage = () => {
      if (application.isApplicantRemovedFromParty) return t('APPLICATION');
      return title || propertyName || t('APPLICATION');
    };

    return (
      <AppBar
        title={
          <T.Title lighter className={cf('title', { isXSmall })}>
            {getTitlePage()}
          </T.Title>
        }
        iconSectionClass={cf('icon-section')}
        className={cf('blue-header', g(className))}
        icon={<IconButton className={cf('icon')} iconName="property" />}>
        {renderAppBarActions()}
      </AppBar>
    );
  }),
);
