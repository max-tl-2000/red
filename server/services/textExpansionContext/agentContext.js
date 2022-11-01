/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';
import { getResetPasswordUrl, generateRegistrationUrl } from '../mails';
import { getResetTokenForUser } from '../tokens';
import { generateInvite } from '../invites';
import { sendUrltoShortener } from '../urlShortener';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;
export const noDbQuery = true;

export const tokensMapping = {
  agent: {
    registrationUrl: async ({ ctx, email, organization, inviteData }) => {
      if (!email || !organization || !inviteData) return null;

      const { token } = await generateInvite(ctx, email, organization, {
        ...inviteData,
        tenantName: ctx.tenantName,
      });
      const url = generateRegistrationUrl(ctx, token);
      const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);
      return shortenedUrl;
    },
    resetPasswordUrl: async ({ ctx, userId }) => {
      if (!userId) return null;

      const token = await getResetTokenForUser(ctx, { id: userId });
      const url = getResetPasswordUrl(ctx, token);
      const [shortenedUrl] = await sendUrltoShortener(ctx, [url]);
      return shortenedUrl;
    },
  },
};
