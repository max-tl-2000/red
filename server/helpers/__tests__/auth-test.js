/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { decodeJWTToken } from '../../../common/server/jwt-helpers';
import { verifyTokenExpiration } from '../../../common/test-helpers/auth';

const { mock } = require('test-helpers/mocker').default(jest);

describe('createApplicationToken', () => {
  let authModule;

  beforeEach(() => {
    mock('../../dal/partyRepo', () => ({
      loadPartyMemberById: sinon.stub().returns([{}]),
    }));

    authModule = require('../auth'); // eslint-disable-line global-require
  });

  const rentAppTokenExpiration = '180d';

  describe('when createApplicationToken function gets called and the expireIn property is not defined', () => {
    it('should use the default token expiration config for RentApp', async () => {
      const token = await authModule.createApplicationToken({}, { person: {}, memberId: '1' }, {});
      expect(token).not.to.equal(null);

      const decodedToken = decodeJWTToken(token);

      verifyTokenExpiration(decodedToken, rentAppTokenExpiration);
    });
  });
});
