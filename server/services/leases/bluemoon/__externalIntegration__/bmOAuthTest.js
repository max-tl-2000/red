/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
const { expect } = chai;
import chaiJWT from 'chai-jwt';
chai.use(chaiJWT);

import { getAccessToken } from '../tokenMgr';
const ctx = { tenantId: 'testTenantId' };

describe('getAccessToken', async () => {
  it('should create an access token successfully', async () => {
    const token = await getAccessToken(ctx);
    expect(token).to.be.a.jwt;
  });
});
