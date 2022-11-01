/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';
import { getResidentQuery } from '../../dal/personRepo';
import { sendUrltoShortener } from '../urlShortener';
import { createResidentToken } from '../../helpers/auth';
import config from '../../config';
import envVal from '../../../common/helpers/env-val';
import { combinePaths } from '../../../common/server/combine-paths';
import { createPostUrl } from './helpers/posts';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { personId, commonUserId }) => getResidentQuery(ctx, { personId, commonUserId }).toString();

// TODO: do not use envVal or domain at this level. Use the config object
const domain = envVal('DOMAIN', 'local.env.reva.tech');

const getDeepLinkShortenedUrl = async (ctx, { residentToken }) => {
  const { deepLinkUrl } = config.resident;

  const { tenantName } = ctx;
  if (!tenantName) {
    throw new Error('Missing tenant name in ctx');
  }

  const residentAppUrl = `https://${combinePaths(`${tenantName}.${domain}`, deepLinkUrl)}?emailToken=${residentToken}`;
  const [shortenedUrl] = await sendUrltoShortener(ctx, [residentAppUrl]);

  return shortenedUrl;
};

export const tokensMapping = {
  username: 'email',
  invitationUrl: async ({ email, personId, commonUserId }, { ctx, propertyId }) => {
    const { signInUrl } = config.resident;

    const residentToken = await createResidentToken(ctx, { email, personId, commonUserId, propertyId, path: signInUrl });

    return await getDeepLinkShortenedUrl(ctx, { residentToken });
  },
  resetPasswordUrl: async ({ email, commonUserId }, { ctx, applicationName, tenantId, currentPropertyId }) => {
    const { hostname, resetPasswordUrl, resetPasswordTokenExpiration } = config.resident;

    const propertyData = currentPropertyId ? { propertyId: currentPropertyId, tenantId } : { isCommonToken: true };

    const residentToken = await createResidentToken(
      {},
      { email, forceLogout: true, commonUserId, applicationName, ...propertyData },
      { expiresIn: resetPasswordTokenExpiration },
    );

    const residentAppUrl = `https://${combinePaths(`${hostname}.${domain}`, resetPasswordUrl)}?emailToken=${residentToken}`;
    const [shortenedUrl] = await sendUrltoShortener(ctx, [residentAppUrl]);
    return shortenedUrl;
  },
  registrationUrl: async ({ email, personId, commonUserId }, { ctx, propertyId }) => {
    const { registrationUrl, registrationTokenExpiration } = config.resident;
    const residentToken = await createResidentToken(
      ctx,
      { email, personId, commonUserId, propertyId, path: registrationUrl },
      { expiresIn: registrationTokenExpiration },
    );

    return await getDeepLinkShortenedUrl(ctx, { residentToken });
  },
  // eslint-disable-next-line no-empty-pattern
  postUrl: async ({}, params) => {
    const { ctx, userEmail, commonUserId, personId, propertyId, postId } = params;
    return await createPostUrl(ctx, config, { email: userEmail, personId, commonUserId, propertyId, postId });
  },
  directMessageUrl: async ({ email, personId, commonUserId }, { ctx, propertyId }) => {
    const { directMessageUrl, directMessageTokenExpiration } = config.resident;
    const residentToken = await createResidentToken(
      ctx,
      { email, personId, commonUserId, propertyId, path: directMessageUrl },
      { expiresIn: directMessageTokenExpiration },
    );

    return await getDeepLinkShortenedUrl(ctx, { residentToken });
  },
};
