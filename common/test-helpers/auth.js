/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import moment from 'moment'; // eslint-disable-line red/no-moment
import { expect } from 'chai';

export const verifyTokenExpiration = (decodedToken, expectedTokenExpiration) => {
  const iat = moment.unix(decodedToken.iat);
  const exp = moment.unix(decodedToken.exp);

  const result = exp.diff(iat, expectedTokenExpiration.substring(expectedTokenExpiration.length - 1));
  const expectedValue = expectedTokenExpiration.substring(0, expectedTokenExpiration.length - 1);
  expect(result).to.equal(+expectedValue);
};
