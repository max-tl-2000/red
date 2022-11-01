/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as validators from '../../../../server/api/helpers/validators';
import { ServiceError } from '../../../../server/common/errors';
import { getFilteredRoommates } from '../../services/roommate';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';
import { createPersonMessageAndRelationship } from '../../services/person-message';
import { DALTypes } from '../../../common/enums/dal-types';
import { sendPersonToPersonMail } from '../../../../server/services/mails';
import { getPersonIdByTenantIdAndUserId, getEmailAddressByUserId } from '../../../../auth/server/services/common-user';
import logger from '../../../../common/helpers/logger';
import { execConcurrent } from '../../../../common/helpers/exec-concurrent';

export const getRoommates = req => {
  const { filter, userId } = req.query;

  const context = {
    propertyId: req.headers.propertyid,
    tenantId: req.headers.tenantid,
    displayBasicFields: !userId,
    userId,
  };

  badRequestErrorIfNotAvailable([{ property: context.propertyId, message: 'MISSING_PROPERTY_ID' }]);

  validators.uuid(context.propertyId, 'INVALID_PROPERTY_ID');

  try {
    return getFilteredRoommates(context, filter);
  } catch (error) {
    logger.error({ error }, 'Error getting roommates');
    throw new ServiceError({
      token: 'ERROR_GETTING_ROOMMATES',
      status: 500,
    });
  }
};

export const sendMessage = async req => {
  const { tenantid: tenantId, tenantname: tenantName } = req.headers;
  const { roommateMessageProperty, messageContent, from, to, communicationType, appName } = req.body;
  const ctx = { tenantId, tenantName, userId: from.id };

  badRequestErrorIfNotAvailable([
    { property: tenantId, message: 'MISSING_TENANT_ID' },
    { property: tenantName, message: 'MISSING_TENANT_NAME' },
    { property: roommateMessageProperty.id, message: 'MISSING_PROPERTY_ID' },
    {
      property: roommateMessageProperty.name,
      message: 'MISSING_PROPERTY_NAME',
    },
    { property: from.id, message: 'MISSING_USER_ID' },
    { property: from.name, message: 'MISSING_USER_NAME' },
  ]);

  const senderPersonId = await getPersonIdByTenantIdAndUserId(ctx, tenantId, from.id);
  const recipients = await execConcurrent(to, async recipient => {
    const recipientPersonId = await getPersonIdByTenantIdAndUserId(ctx, tenantId, recipient.id);
    const emailAddress = await getEmailAddressByUserId(ctx, recipient.id);
    return {
      ...recipient,
      contactReference: emailAddress,
      personId: recipientPersonId,
    };
  });

  const personMessageRaw = {
    propertyId: roommateMessageProperty.id,
    from: { ...from, personId: senderPersonId },
    to: recipients,
    body: messageContent,
    status: DALTypes.PersonMessageStatus.SENT,
    communicationType,
    appName,
  };

  await createPersonMessageAndRelationship(tenantId, personMessageRaw);

  const emailData = {
    from: personMessageRaw.from,
    to: personMessageRaw.to[0],
    subject: `Message from ${from.name} on ${roommateMessageProperty.name} roommate finder`,
    content: messageContent,
  };

  return sendPersonToPersonMail(ctx, emailData);
};
