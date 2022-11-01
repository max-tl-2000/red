/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { tryDecodeJWTToken } from '../../../../common/server/jwt-helpers';
import { getCommsTemplateSettingsById, isPersonUnsubscribedFromComm } from '../../../../server/dal/commsTemplateRepo';
import {
  getNotificationByRecipientId,
  saveNotificationUnsubscription,
  getNotificationByDirectMessageNotificationId,
} from '../../../../server/dal/cohortCommsRepo';
import { getTenantById } from '../../dal/tenant-repo';
import { ServiceError } from '../../../../server/common/errors';

export const getDataFromUnsubscribeToken = async req => {
  const { unsubscribeToken } = req.body;

  const { result: tokenInfo, successful } = tryDecodeJWTToken(unsubscribeToken, null, {
    jwtConfigKeyName: 'resident.emailJwtSecret',
    encryptionConfigKeyName: 'resident.emailEncryptionKey',
  });

  if (!successful) {
    throw new ServiceError({ token: 'INVALID_TOKEN', status: 401 });
  }

  const { commsTemplateSettingsId, recipientId, tenantId, directMessageNotificationId } = tokenInfo;

  const ctx = { tenantId };
  let notification;

  const { action } = await getCommsTemplateSettingsById(ctx, commsTemplateSettingsId);
  if (recipientId) {
    notification = await getNotificationByRecipientId(ctx, recipientId);
  } else {
    notification = await getNotificationByDirectMessageNotificationId(ctx, directMessageNotificationId);
  }
  const { name: tenantName } = await getTenantById(ctx.tenantId);

  return {
    type: 'json',
    content: {
      commsTemplateSettingsId,
      commsSubcategory: action,
      tenantName,
      tenantId,
      ...notification,
    },
  };
};

export const unsubscribePersonFromComms = async req => {
  const { tenantId, ...unsubscriptionInfo } = req.body;
  const ctx = { tenantId };

  const { personId, commsTemplateSettingsId } = unsubscriptionInfo;
  const isPersonUnsubscribed = await isPersonUnsubscribedFromComm(ctx, personId, commsTemplateSettingsId);
  if (!isPersonUnsubscribed) await saveNotificationUnsubscription(ctx, unsubscriptionInfo);

  return {
    type: 'json',
    content: { status: 1 },
  };
};
