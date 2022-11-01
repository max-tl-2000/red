/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from '../helpers/mediator';
import { setCookie } from '../helpers/cookieHelper';
import cfg from '../helpers/cfg';

const sisenseConfig = cfg('sisenseConfig', {});

export const init = () => {
  mediator.on('user:login', (e, args) => {
    setCookie(sisenseConfig.cookieName, args.user.sisenseCookieValue, {
      expires: sisenseConfig.cookieExpirationDays,
      path: '/',
      domain: sisenseConfig.cookieDomain,
    });
  });
};
