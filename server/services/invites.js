/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { createInvite as createInviteInDb, getInviteByToken as getInviteByTokenFromDb } from '../dal/usersInvitesRepo.js';
import { validateEmail } from '../../common/helpers/validations/email';
import { ServiceError } from '../common/errors';
import logger from '../../common/helpers/logger';

const expiryPeriodInMiliseconds = 3 * 86400000; // 3 days

// TODO: Should generate a unique code validating against DB or using time as seed to assure uniqueness
export const generateInviteCode = organization => {
  // TODO organization search
  if (organization != null) {
    // TODO setting as a simple increase for ease of use in demo, it should create a unique string not easy to replicate
    return `code${getUUID()}`;
  }
  return 'code01';
};

export const generateInvite = async (ctx, mail, organization, inviteData) => {
  logger.trace({ ctx, mail, organization, inviteData }, 'generateInvite');
  const mailError = validateEmail(mail);
  if (mailError !== '') {
    return Promise.reject({
      token: mailError,
    });
  }

  const date = new Date();
  const invite = {
    valid: true,
    email: mail,
    sent_date: date,
    expiry_date: new Date(date.getTime() + expiryPeriodInMiliseconds), // 3 days
    token: generateInviteCode(organization),
    inviteData,
  };

  return createInviteInDb(ctx, invite);
};

export const getInviteByToken = async (ctx, token) => {
  const matchingInvite = await getInviteByTokenFromDb(ctx, token);
  if (!matchingInvite) {
    throw new ServiceError({
      token: 'NO_MATCHING_INVITE',
      status: 404,
    });
  }

  if (!matchingInvite.valid || matchingInvite.expiry_date <= new Date()) {
    throw new ServiceError({
      token: 'INVITE_EXPIRED',
      status: 400,
    });
  }

  return matchingInvite;
};

export const getInviteTemplate = organization => (organization ? 'template' : 'defaultTemplate');
