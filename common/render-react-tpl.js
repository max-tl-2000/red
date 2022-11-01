/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { detectBrowserFromReq } from './server/browser-detector.ts';

export const renderReactTpl = (Component, { req = {}, props = {}, supportedBrowsers } = {}) => {
  const detectedBrowser = detectBrowserFromReq(req, supportedBrowsers);

  const docType = '<!doctype html>';
  return `${docType}\n${renderToString(<Component {...props} detectedBrowser={detectedBrowser} supportedBrowsers={supportedBrowsers} />)}`;
};
