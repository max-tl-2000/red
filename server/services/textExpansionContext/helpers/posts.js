/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createResidentToken } from '../../../helpers/auth';
import { combinePaths } from '../../../../common/server/combine-paths';
import { sendUrltoShortener } from '../../urlShortener';
import trim from '../../../../common/helpers/trim';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';

export const createPostUrl = async (ctx, serverConfig, { propertyId, postId }) => {
  const { deepLinkUrl, postUrl, hostname } = serverConfig?.resident || {};

  const path = trim(postUrl).replace(/:postId/, postId);

  const url = `${hostname}.${serverConfig.domain}`;
  const { tenantId } = ctx;
  const residentAppUrl = addParamsToUrl(`https://${combinePaths(url, deepLinkUrl)}`, { propertyId, tenantId, path });

  const [shortenedUrl] = await sendUrltoShortener(ctx, [residentAppUrl]);

  return shortenedUrl;
};

export const createUnsubscribeUrl = async (ctx, serverConfig, { recipientId, commsTemplateSettingsId, directMessageNotificationId }) => {
  const { hostname, unsubscribeLink } = serverConfig?.resident || {};

  const tokenInfo = { commsTemplateSettingsId };
  if (recipientId) tokenInfo.recipientId = recipientId;
  if (directMessageNotificationId) tokenInfo.directMessageNotificationId = directMessageNotificationId;

  const unsubscribeToken = await createResidentToken(ctx, tokenInfo);
  const url = `${hostname}.${serverConfig.domain}${unsubscribeLink}`;
  const unsubscribeUrl = `https://${url}?token=${unsubscribeToken}`;
  const [shortenedUrl] = await sendUrltoShortener(ctx, [unsubscribeUrl]);
  return shortenedUrl;
};
