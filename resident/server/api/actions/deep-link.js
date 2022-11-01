/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { handleDeepLink as handleDeepLinkService } from '../../services/deep-link';
import { decodeEmailToken } from '../../common/decode-email-token';
import { ServiceError } from '../../../../server/common/errors';
import { checkFields } from '../../common/check-fields';
import { wasCommonUserPasswordPreviouslySet } from '../../dal/common-user-repo';
import residentConfig from '../../../config';

export const handleDeepLink = async req => {
  const { emailToken } = req.query;

  let args = {};

  if (emailToken) {
    const { getApp, redirectionPath } = req.query;

    const decodedEmailToken = decodeEmailToken(emailToken);
    if (!decodedEmailToken.successful) {
      throw new ServiceError({ token: decodedEmailToken.errorToken });
    }
    const { result } = decodedEmailToken;

    checkFields(req, result, ['propertyId', 'personId', 'commonUserId', 'tenantId']);

    const { propertyId, path, tenantId, commonUserId, forceLogout } = result;

    let urlPath = redirectionPath || path;

    const { registrationUrl, signInPasswordUrl } = residentConfig;

    if (urlPath === registrationUrl) {
      const userHasPasswordSet = await wasCommonUserPasswordPreviouslySet(req, commonUserId);
      if (userHasPasswordSet) {
        urlPath = signInPasswordUrl;
      }
    }

    const queryParams = { emailToken, forceLogout, getApp };

    args = {
      propertyId,
      tenantId,
      path: urlPath,
      queryParams,
    };
  } else {
    checkFields(req, req.query, ['propertyId', 'tenantId', 'path']);

    const { propertyId, tenantId, path } = req.query;

    const webQueryParams = { propertyId, tenantId };

    args = {
      propertyId,
      tenantId,
      path,
      webQueryParams,
    };
  }

  const { html, redirectionUrl } = await handleDeepLinkService(req, args);

  if (redirectionUrl) {
    return {
      type: 'redirect',
      redirectTo: redirectionUrl,
    };
  }

  return {
    type: 'html',
    content: html,
  };
};
