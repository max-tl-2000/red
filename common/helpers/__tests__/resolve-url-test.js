/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { resolveSubdomainURL } from '../resolve-url';

describe('resolveSubdomainURL', () => {
  it('when localhost it should bypass subdomain', async () => {
    const res = resolveSubdomainURL('http://localhost:3000/register', 'red');
    expect(res).to.equal('http://localhost:3000/register');
  });

  it('when subdomain is different it is reflected in the URL', async () => {
    const res = resolveSubdomainURL('http://red.dev.env.reva.tech:3000/register', 'admin');
    expect(res).to.equal('http://admin.dev.env.reva.tech:3000/register');
  });

  it('when subdomain is the same the URL stays the same', async () => {
    const res = resolveSubdomainURL('http://red.dev.env.reva.tech:3000/register', 'red');
    expect(res).to.equal('http://red.dev.env.reva.tech:3000/register');
  });
});
