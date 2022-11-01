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
import { getZendeskPrivateContentToken } from '../../services/users';

const logger = loggerModule.child({ subType: 'zendesk' });

const getZendeskCookieValue = ({ email, name, organization }) =>
  jwt.sign(
    {
      email,
      name,
      organization,
    },
    config.auth.secret,
    {
      algorithm: config.auth.algorithm,
    },
  );

export const getZendeskKeys = ({ email, name, organization }) => ({
  zendeskPrivateContentToken: getZendeskPrivateContentToken({ email, name }),
  zendeskCookieValue: getZendeskCookieValue({ email, name, organization }),
});

export const login = (req, res) => {
  logger.trace('zendesk login');
  if (!req.cookies[config.zendesk.cookieName]) {
    logger.warn('missing cookie');
    res.send('Missing cookie');
    res.end();
    return;
  }
  logger.debug({ value: req.cookies[config.zendesk.cookieName] }, 'zendesk cookie value');

  let zendesk = {};
  try {
    zendesk = jwt.verify(req.cookies[config.zendesk.cookieName], config.auth.secret);
    logger.debug(zendesk, 'values from zendesk cookie');
  } catch (e) {
    logger.error({ e }, 'error on verify zendesk cookie value');
    res.send('Missing cookie');
    res.end();
    return;
  }

  const token = jwt.sign(
    {
      iat: new Date().getTime() / 1000,
      jti: newUUID(),
      email: zendesk.email,
      name: zendesk.name,
      organization: zendesk.organization,
    },
    config.zendesk.secretAuth,
    {
      algorithm: config.zendesk.algorithm,
    },
  );
  let redirect = `${config.zendesk.ssoEndPoint}${token}`;

  const query = url.parse(req.url, true).query;

  if (query.return_to) {
    redirect += `&return_to=${encodeURIComponent(query.return_to)}`;
  }

  logger.debug(
    {
      endpoint: config.zendesk.ssoEndPoint,
      email: zendesk.email,
      name: zendesk.name,
      redirect,
    },
    'zendesk redirect',
  );

  res.writeHead(302, {
    Location: redirect,
  });
  res.end();
};

export const logout = (req, res) => {
  logger.trace('zendesk logout');
  res.cookie(config.zendesk.cookieName, '', {
    domain: config.zendesk.cookieDomain,
    maxAge: -1,
  });
  res.send('logout successful');
};

export const zendeskPrivateContentToken = req => {
  const { fullName: name, email } = req.authUser;
  return getZendeskPrivateContentToken({ email, name });
};
