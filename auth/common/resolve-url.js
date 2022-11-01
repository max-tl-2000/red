/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolveSubdomainURL } from '../../common/helpers/resolve-url';
import { location } from '../../client/helpers/navigator';
import { setQueryParams } from '../../client/helpers/url';

const authSubdomainName = 'auth';

export const resolveAuthAppInUrl = (baseUrl, path) => {
  const url = resolveSubdomainURL(baseUrl, authSubdomainName);
  return `${url}/${path}`;
};

export const getSignInUrl = token => resolveAuthAppInUrl(location.origin, `login?token=${token}`);

export const getResetPasswordUrl = ({ appId, confirmUrl, cancelLinkId, token }) => {
  const params = { appId, confirmUrl, cancelLinkId };
  token && Object.assign(params, { token });
  return resolveAuthAppInUrl(location.origin, setQueryParams({ url: 'resetPassword', params }));
};

export const getConfirmResetPasswordUrl = confirmToken => resolveAuthAppInUrl(location.origin, `confirm?confirmToken=${confirmToken}`);
