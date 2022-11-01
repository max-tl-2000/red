/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../../common/helpers/logger';
import { createPersonMessage } from '../dal/person-message-repo';
import { createPersonRelationship, updatePersonRelationship, getPersonRelationshipByFilter } from '../dal/person-relationship-repo';
import { DALTypes, PerformAction } from '../../common/enums/dal-types';
import { badRequestErrorIfNotAvailable } from '../../../common/helpers/validators';

const validatePersonMessage = (tenantId, { propertyId, from, to, appName }) =>
  badRequestErrorIfNotAvailable([
    { property: tenantId, message: 'MISSING_TENANT_ID' },
    { property: propertyId, message: 'MISSING_PROPERTY_ID' },
    { property: from.id, message: 'MISSING_SENDER_ID' },
    { property: to[0].id, message: 'MISSING_RECIPIENTS_ID' },
    { property: appName, message: 'MISSING_APP_NAME' },
  ]);

const requireActionOnPersonRelationship = (personRelationship, performAction) => {
  switch (performAction) {
    case PerformAction.CREATE:
      return !personRelationship;
    case PerformAction.UPDATE:
      return personRelationship && personRelationship.status === DALTypes.PersonRelationshipStatus.PENDING;
    default:
      return false;
  }
};

const handleCreatePersonRelationship = async (tenantId, filter, appName) => {
  const personRelationship = await getPersonRelationshipByFilter(tenantId, filter);
  if (!requireActionOnPersonRelationship(personRelationship, PerformAction.CREATE)) {
    return;
  }

  const newPersonRelationship = {
    ...filter,
    status: DALTypes.PersonRelationshipStatus.PENDING,
    appName,
  };
  await createPersonRelationship(tenantId, newPersonRelationship);
};

const handleUpdatePersonRelationship = async (tenantId, filter) => {
  const personRelationship = await getPersonRelationshipByFilter(tenantId, filter);
  if (!requireActionOnPersonRelationship(personRelationship, PerformAction.UPDATE)) {
    return;
  }

  await updatePersonRelationship(tenantId, personRelationship.id, {
    status: DALTypes.PersonRelationshipStatus.ACTIVE,
  });
};

export const createPersonMessageAndRelationship = async (tenantId, personMessageRaw) => {
  const { propertyId, body, from, to, status, communicationType, appName } = personMessageRaw;

  logger.info({ tenantId, appName, propertyId, communicationType, from, to }, 'createPersonMessage');
  validatePersonMessage(tenantId, personMessageRaw);

  const { personId: senderPersonId } = from;

  // TODO: update to handle multiple recipients, by now we only send message to 1 roommate
  const [recipientPersonId] = to.map(x => x.personId);

  await createPersonMessage(tenantId, {
    propertyId,
    body,
    from: senderPersonId,
    to: [recipientPersonId],
    status,
    type: communicationType,
    appName,
  });

  // Check if I dont have a record in PersonRelationship FROM A TO B (meaning I am starting a conversation)
  let filter = { propertyId, from: senderPersonId, to: recipientPersonId };
  await handleCreatePersonRelationship(tenantId, filter, appName);

  // Check if I have already a pending record in PersonRelationship FROM B TO A (meaning I am answering an existing conversation)
  filter = { propertyId, from: recipientPersonId, to: senderPersonId };
  await handleUpdatePersonRelationship(tenantId, filter);
};
