/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createJWTToken, decodeJWTToken } from '../jwt-helpers';
import { commonConfig as config } from '../../server-config';
import { verifyTokenExpiration } from '../../test-helpers/auth';

describe('JWT', () => {
  describe('when create a token', () => {
    const tokenInfo = {
      email: 'bill@reva.tech',
    };
    [
      {
        data: tokenInfo,
      },
      {
        data: tokenInfo,
        expiresIn: '7h',
      },
      {
        data: tokenInfo,
        expiresIn: '30d',
      },
    ].forEach(({ data, expiresIn }) => {
      const expirationTime = expiresIn || `${config.auth.expiresIn}d`;
      it(`It should return a valid expiration time: ${expirationTime} `, () => {
        const token = createJWTToken(data, { expiresIn });
        const decodedToken = decodeJWTToken(token);

        verifyTokenExpiration(decodedToken, expirationTime);
        expect(decodedToken.email).to.equal(data.email);
      });
    });
  });
});
