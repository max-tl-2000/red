/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, overrider } from 'test-helpers';
import * as globals from '../../../common/helpers/globals';
import { resolveTenantInUrl } from '../resolve-url';

describe('Resolve Url helper', () => {
  const tenantName = 'application';
  const baseUrl = 'https://tenant.local.env.reva.tech/';
  const token = 'encoded-token';
  let ov;
  // create it before each test
  beforeEach(() => {
    ov = overrider.create(globals);
    // we don't need to worry about restoring window
    // as the overrider will restore the original window variable
    // on the global afterEach handler
    ov.override('window', {
      __appData: {},
    });
  });
  describe('Resolve tenant in the url', () => {
    it('should return the resolved url with the tenant replaced', () => {
      const expectedResult = `https://${tenantName}.local.env.reva.tech/${token}`;
      globals.window.__appData.rentapp = {
        hostname: tenantName,
      };

      const urlResolved = resolveTenantInUrl(baseUrl, token);
      expect(urlResolved).to.equal(expectedResult);
    });
  });
});
