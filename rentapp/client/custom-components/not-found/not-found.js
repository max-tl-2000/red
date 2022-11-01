/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import ErrorBlock from '../error-block/error-block';
import { cf } from './not-found.scss';
import { Page } from '../page/page';
import { RentAppBar } from '../rentapp-bar/rentapp-bar';
import { AppFooter } from '../app-footer/app-footer';

const NotFound = ({ error, propertyName }) => (
  <Page appBar={<RentAppBar propertyName={t(propertyName)} />}>
    <div className={cf('container')}>
      <ErrorBlock error={error} />
      <AppFooter className={cf('footer-bottom-aligned')} />
    </div>
  </Page>
);

export default NotFound;
