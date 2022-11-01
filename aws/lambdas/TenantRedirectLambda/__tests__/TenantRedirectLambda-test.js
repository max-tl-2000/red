/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testEvent } from './testData';
import { getRedirectedTenantHostname, getRequestPath } from '../index';

describe('getRedirectedTenantHostname()', () => {
  describe('given a mapped tenant hostname', () => {
    it('should return redirected tenant hostname', () => {
      expect(getRedirectedTenantHostname(testEvent?.headers?.host)).to.be.equal('chris-new.staging.env.reva.tech');
      expect(getRedirectedTenantHostname('customerold.reva.tech')).to.be.equal('customernew.reva.tech');
    });
  });
  describe('given an unmapped tenant hostname', () => {
    it('should not return a redirected tenant hostname', () => {
      expect(getRedirectedTenantHostname('redirected.staging.env.reva.tech')).to.be.undefined;
      expect(getRedirectedTenantHostname('maximus.reva.tech')).to.be.undefined;
    });
  });
});

describe('getRequestPath()', () => {
  describe('given a http request aws event', () => {
    it('should return the http request path', () => {
      const { path, queryStringParameters } = testEvent;
      expect(getRequestPath(path, queryStringParameters)).to.be.equal('/api/v1/marketing/properties?param1=1&param2=2');
      expect(getRequestPath('/api/path', { param: 'value' })).to.be.equal('/api/path?param=value');
      expect(getRequestPath('/api/other/path')).to.be.equal('/api/other/path');
      expect(getRequestPath()).to.be.undefined;
    });
  });
});
