/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolveAuthAppInUrl, getResetPasswordUrl as getAuthResetPasswordUrl } from '../../auth/common/resolve-url';
import { DALTypes } from '../common/enums/dal-types';

const registerConfirmPath = '/confirm';

export const getRoommatesConfirmUrl = ({ tenantName, propertyName }) => `${window.location.origin}/${tenantName}/${propertyName}${registerConfirmPath}`;

export const getRoommatesResetPasswordUrl = () => `${window.location.origin}/:tenantName/:propertyName${registerConfirmPath}`;

export const getStartRegistrationUrl = token => resolveAuthAppInUrl(window.location.origin, `register?token=${token}`);

export const getSignInUrl = () => resolveAuthAppInUrl(window.location.origin, `login?appId=${DALTypes.AppId}`);

export const getConfirmRegisterUrl = confirmToken => resolveAuthAppInUrl(window.location.origin, `confirm?confirmToken=${confirmToken}`);

export const getResetPasswordUrl = cancelLinkId =>
  getAuthResetPasswordUrl({
    appId: DALTypes.AppId,
    confirmUrl: getRoommatesResetPasswordUrl(),
    cancelLinkId,
  });

export const getResetPasswordUrlFromMyProfile = token => resolveAuthAppInUrl(window.location.origin, `confirm?confirmToken=${token}`);
