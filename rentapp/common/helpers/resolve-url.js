/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolveAuthAppInUrl, getResetPasswordUrl as getAuthResetPasswordUrl } from '../../../auth/common/resolve-url';
import { AppId } from '../enums/rentapp-types';
import { REPLACE_TOKEN } from '../application-constants';
import { isApplicationPaid } from '../../../common/helpers/applicants-utils';
import { resolveSubdomainURL } from '../../../common/helpers/resolve-url';
import { location } from '../../../client/helpers/navigator';

// TODO: This has helpers have to be in a common helper, changes in roommates code will be required
export const getLoginUrl = () => resolveAuthAppInUrl(window.location.origin, `login?appId=${AppId}`);

export const getResetPasswordUrl = cancelLinkId =>
  getAuthResetPasswordUrl({
    appId: AppId,
    confirmUrl: '/applicationList',
    cancelLinkId,
  });

export const getAfterLoginUrl = (previousUrl, token) => (previousUrl ? previousUrl.replace(REPLACE_TOKEN, token) : `/applicationList/${token}`);

export const getValidatedApplicationUrl = (isUserAuthenticated, application) => {
  const hasPaidApplication = isApplicationPaid(application);
  const token = !isUserAuthenticated ? REPLACE_TOKEN : application.token;
  let applicationUrl = hasPaidApplication ? `applicationAdditionalInfo/${token}` : `applyNow/${token}`;
  applicationUrl = !isUserAuthenticated ? applicationUrl : `${applicationUrl}?userId=${application.commonUserId}`;
  return `${resolveSubdomainURL(location.origin, 'application')}/${applicationUrl}`;
};

export const getValidatedLoginUrl = isRedirection => (isRedirection ? `${resolveSubdomainURL(location.origin, 'application')}/` : '/');
