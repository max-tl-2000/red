/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { parseTenantName } from '../helpers/email';

describe('given an invalid email address', () => {
  it('tenant name cannot be parsed from it', () => {
    expect(parseTenantName()).to.not.be.ok;
    expect(parseTenantName('something')).to.not.be.ok;
    expect(parseTenantName('something@')).to.not.be.ok;
    expect(parseTenantName('something@something')).to.not.be.ok;
  });
});

describe('given an email address of form `something@tenant(.subdomain).domain.com`', () => {
  it('tenant name can be parsed from it', () => {
    expect(parseTenantName('something@tenant.reva.tech')).to.equal('tenant');
    expect(parseTenantName('something@tenant.mail.reva.tech')).to.equal('tenant');
  });
});
