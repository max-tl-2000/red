/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import cfg from 'helpers/cfg';
import { setCookie } from 'helpers/cookieHelper';

const sisenseConfig = cfg('sisenseConfig', {});

const changeSisenseIFrameSrc = newSrc => {
  if (!newSrc) return;

  const sisenseIframe = document.getElementById('sisenseIframe');
  sisenseIframe && sisenseIframe.setAttribute('src', newSrc);
};

export const sisenseLogout = () => {
  setCookie(sisenseConfig.cookieName, '', {
    expires: -1,
    path: '/',
    domain: sisenseConfig.cookieDomain,
  });
  changeSisenseIFrameSrc(sisenseConfig.logoutURL);
};

export const getUnitPricingUrl = () => sisenseConfig.unitPricingURL;
