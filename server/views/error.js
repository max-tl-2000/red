/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Page from './page';

const ErrorPage = ({ serverError, ...rest }) => {
  const { t, getResource } = rest;
  const pageCSSAssets = [getResource({ name: 'errorPage.css', skipInDev: true })];
  const pageJSAssets = [getResource({ name: 'errorPage.js', dev: true })];

  const pageData = {
    serverError,
  };

  return <Page pageAppData={pageData} pageCSSAssets={pageCSSAssets} pageJSAssets={pageJSAssets} title={t('ERROR_PAGE_TITLE')} {...rest} />;
};

export default ErrorPage;
