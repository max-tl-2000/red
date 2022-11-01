/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import jwt from 'jsonwebtoken';
import get from 'lodash/get';
import { commonConfig as config } from '../server-config';
import { encrypt, decrypt, decryptWithKey } from './crypto-helper';
import { now } from '../helpers/moment-utils';
import loggerModule from '../helpers/logger';

const logger = loggerModule.child({ subType: 'jwtHelper' });

const secondsInADay = 86400;
const convertDaysToSeconds = days => days * secondsInADay;

const getSecondsUntilMidnight = utcOffset => {
  const currentTimeAtClient = now().subtract(utcOffset, 'minutes');
  const midnightAtClient = now().subtract(utcOffset, 'minutes').add(1, 'days').startOf('Day');
  return midnightAtClient.diff(currentTimeAtClient, 'seconds');
};

const getTokenValidityPeriod = utcOffset => {
  const secondsUntilMidnight = utcOffset ? getSecondsUntilMidnight(utcOffset) : 0;
  const secondsFromMidnightToExpiration = convertDaysToSeconds(config.auth.expiresIn);
  return secondsUntilMidnight + secondsFromMidnightToExpiration;
};

export function createJWTToken(user, options = {}) {
  const { expiresIn, utcOffset, jwtConfigKeyName, encryptionConfigKeyName } = options;

  const encrypted = encrypt(JSON.stringify(user), encryptionConfigKeyName);

  const token = jwt.sign({ body: encrypted }, get(config, jwtConfigKeyName) || config.auth.secret, {
    expiresIn: expiresIn || getTokenValidityPeriod(utcOffset),
    algorithm: config.auth.algorithm,
    issuer: user.domain,
  });
  return token;
}

export const createLeasingUserToken = (ctx, user, options = {}) => {
  const { utcOffset } = options;
  const secondsUntilMidnight = getSecondsUntilMidnight(utcOffset);
  logger.debug({ ctx, tokenUser: user, options, secondsUntilMidnight }, 'creating leasing user token');
  return createJWTToken(user, {
    expiresIn: secondsUntilMidnight,
    ...options,
  });
};

export const decodeJWTToken = (token, decryptionKey, { jwtConfigKeyName, encryptionConfigKeyName } = {}) => {
  const jwtKey = get(config, jwtConfigKeyName) || config.auth.secret;
  const { body, ...rest } = jwt.verify(token, jwtKey);

  const encryptionKey = decryptionKey || get(config, encryptionConfigKeyName);
  const decrypted = encryptionKey ? decryptWithKey(body, encryptionKey) : decrypt(body);
  const parsed = JSON.parse(decrypted);

  return { ...rest, ...parsed };
};

export const tryDecodeJWTToken = (...args) => {
  try {
    return { successful: true, result: decodeJWTToken(...args) };
  } catch (e) {
    console.error(e);
    return { successful: false, result: {} };
  }
};

// Utility function to decrypt JWT tokens
// Usage:
// node_modules/.bin/babel-node common/jwt-helpers.js token [encryptionKey]
async function main() {
  const token = process.argv[2];
  const encryptionKey = process.argv[3];

  if (!token) {
    console.log('Usage: token [encryptionKey]');
    return;
  }

  console.log('Going to decrypt token...');
  const decryptedToken = decodeJWTToken(token, encryptionKey);
  console.log(`Decrypted token: ${JSON.stringify(decryptedToken, null, 2)}`);
}

if (require.main === module) {
  main().catch(e => {
    console.log(e.stack);
  });
}
