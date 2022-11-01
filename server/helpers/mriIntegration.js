/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../config';

export const ApiProviders = {
  MRI_S: 'mri_s', // APIs exposed by MRI
  MRI_API: 'mri_api', // Custom APIs added on top of the existing MRI APIs,
};

export const getAuthorizationToken = ({ apiProvider }) => {
  const { user, password } = config.mri[apiProvider].credentials;
  const credentials = `${user}:${password}`;
  const b64 = Buffer.from(credentials).toString('base64');
  return `Basic ${b64}`;
};

export const getQueryParamsString = queryParams => {
  if (!queryParams) return '';

  return Object.keys(queryParams)
    .map(key => `${key}=${queryParams[key]}`)
    .join('&');
};

export const getMriEndPoint = ({ apiProvider, apiType, nameId, isUpdate, queryParams }) => {
  switch (apiProvider) {
    case ApiProviders.MRI_S: {
      const method = isUpdate ? 'put' : 'post';
      let url = `${config.mri[apiProvider].apiUrl}?$api=${apiType}`;
      if (isUpdate) url += `&ResidentID=${nameId}`;

      const paramString = getQueryParamsString(queryParams);
      url += paramString ? `&${paramString}` : '';

      return { url, method };
    }
    case ApiProviders.MRI_API: {
      let url = `${config.mri[apiProvider].apiUrl}/${apiType}`;
      const paramString = getQueryParamsString(queryParams);
      url += paramString ? `?${paramString}` : '';

      return { url, method: 'post' };
    }
    default: {
      throw new Error(`Invalid api provider: ${apiProvider}`);
    }
  }
};
