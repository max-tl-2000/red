/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { HOSTNAME_FROM_URL } from '../regex';

export const resolveSubdomainURL = (url, subdomain, withProtocol = true) => {
  if (withProtocol) {
    return url.replace(new RegExp(HOSTNAME_FROM_URL), `$1${subdomain}$2`);
  }
  url = url.split('.');
  url.shift();
  return [subdomain, ...url].join('.');
};

export const doesUrlHasProtocol = url => {
  if (!url) return false;

  const matches = url.match(/^https?:\/\//i) || [];
  return matches.length;
};

export const prefixUrlWithProtocol = url => {
  if (!url) return '';

  return doesUrlHasProtocol(url) ? url : `https://${url}`;
};
