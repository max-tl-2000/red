/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { combine } from '../../common/helpers/urlPath';
import Page from './page';

const NotFound = ({ pagePaths, sisenseDomain, envHostPart, ...rest }) => {
  const { t, getResource } = rest;
  const pageCSSAssets = [getResource({ name: 'notFound.css', skipInDev: true })];
  const pageJSAssets = [getResource({ name: 'notFound.js', dev: true })];

  if (!sisenseDomain) throw new Error('Missing sisense domain');

  const paths = {
    ...pagePaths,
    reportingSignIn: combine('https', sisenseDomain, '/app/account#/login'),
    rentappSignIn: `https://application.${envHostPart}`,
  };

  return <Page pageCSSAssets={pageCSSAssets} pagePaths={paths} pageJSAssets={pageJSAssets} title={t('PAGE_NOT_FOUND_TITLE')} {...rest} />;
};

export default NotFound;
