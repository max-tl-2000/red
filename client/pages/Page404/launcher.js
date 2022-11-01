/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Page404 from './Page404';
import { renderContent } from '../../helpers/launcher-common';
import cfg from '../../helpers/cfg';

renderContent(Page404, {
  target: document.querySelector('#content'),
  getStores() {
    return {
      tenant: {
        name: cfg('tenantName'),
      },
      urls: cfg('urls'),
    };
  },
});
