/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import jwt from 'jsonwebtoken';
import newUUID from 'uuid/v4';
import url from 'url';
import config from '../../config';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'sisense' });

const getSisenseCookieValue = email =>
  jwt.sign(
    {
      email,
    },
    config.auth.secret,
    {
      algorithm: config.auth.algorithm,
    },
  );

export const getSisenseKeys = email => ({
  sisenseCookieValue: getSisenseCookieValue(email),
});

const generateJwtPayload = userEmail => ({
  iat: parseInt(new Date().getTime() / 1000, 10),
  sub: userEmail,
  jti: newUUID(),
});

export const loginToSisense = (request, response) => {
  logger.trace('Sisense login');
  if (!request.cookies[config.sisense.cookieName]) {
    logger.warn('missing cookie');
    response.writeHead(302, {
      Location: '/',
    });
    response.end();
    return;
  }

  logger.debug({ value: request.cookies[config.sisense.cookieName] }, 'sisense cookie value');

  let sisense = {};
  try {
    sisense = jwt.verify(request.cookies[config.sisense.cookieName], config.auth.secret);
    logger.debug(sisense, 'values from sisense cookie');
  } catch (e) {
    logger.error({ e }, 'error on verify sisense cookie value');
    response.send('Missing cookie');
    response.end();
    return;
  }

  const payload = generateJwtPayload(sisense.email);
  const token = jwt.sign(payload, config.sisense.ssoSecret);
  const sisenseLandingPage = `https://${config.sisense.domain}`;
  let redirect = `${sisenseLandingPage}/jwt?jwt=${token}`;

  const query = url.parse(request.url, true).query;
  if (query.return_to) {
    redirect += `&return_to=${encodeURIComponent(sisenseLandingPage)}${encodeURIComponent(query.return_to)}`;
  }

  logger.debug(
    {
      endpoint: sisenseLandingPage,
      email: sisense.email,
      redirect,
    },
    'sisense redirect',
  );

  response.writeHead(302, {
    Location: redirect,
  });

  response.end();
};
