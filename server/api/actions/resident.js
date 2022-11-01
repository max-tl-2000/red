/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isUuid } from '../helpers/validators';
import { ServiceError } from '../../common/errors';
import { getCommonUserByPersonIds, createCommonUsersByPersonIds } from '../../../auth/server/services/common-user';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { loadPartyMembers, loadPartyById } from '../../services/party';
import loggerModule from '../../../common/helpers/logger';
import ResidentInvitationActions from '../../../common/enums/residentInvitationActions';
import { overridePersonsWithContactInfo } from '../../services/person';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'resident' });

const isUUID = (uuid, token, status = 404) => {
  if (!isUuid(uuid)) {
    throw new ServiceError({ token, status });
  }
  return uuid;
};

const isPersonRegistered = commonUser => commonUser?.password;

export const getPersonIdsGroupedByTemplateType = (personIds, commonUsers) =>
  personIds.reduce(
    (acc, personId) => {
      isUUID(personId, 'INVALID_PERSON_ID');
      const commonUser = commonUsers.find(cu => cu.personId === personId);
      if (!commonUser) {
        acc.commonUsersToCreate.push(personId);
      }

      if (isPersonRegistered(commonUser)) {
        acc.invitePersonIds.push(personId);
      } else {
        acc.newRegistrationPersonIds.push(personId);
      }
      return acc;
    },
    { newRegistrationPersonIds: [], invitePersonIds: [], commonUsersToCreate: [] },
  );

const sendResidentCommMessage = async (
  ctx,
  { propertyId, partyId, context, newRegistrationPersonIds, invitePersonIds, invitePersonsOverride, newRegistrationPersonsOverride, rest },
) => {
  const basePropertyTemplate = { propertyId, section: 'CONSUMER_ACCOUNT' };
  const queueMessageData = {
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.OUTBOUND_COMM,
    message: {
      ctx: {
        tenantId: ctx.tenantId,
        tenantName: ctx.tenantName,
      },
      partyId,
      context,
      ...rest,
    },
    ctx,
  };

  if (newRegistrationPersonIds.length) {
    await sendMessage({
      ...queueMessageData,
      message: {
        ...queueMessageData.message,
        personIds: newRegistrationPersonIds,
        propertyTemplate: {
          ...basePropertyTemplate,
          action: ResidentInvitationActions.NEW_RESIDENT_REGISTRATION,
        },
        personsOverride: newRegistrationPersonsOverride,
        communicationCategory: DALTypes.CommunicationCategory.RESIDENT_INVITE,
      },
    });
  }

  if (invitePersonIds.length) {
    await sendMessage({
      ...queueMessageData,
      message: {
        ...queueMessageData.message,
        personIds: invitePersonIds,
        propertyTemplate: {
          ...basePropertyTemplate,
          action: ResidentInvitationActions.RESIDENT_INVITATION,
        },
        personsOverride: invitePersonsOverride,
        communicationCategory: DALTypes.CommunicationCategory.RESIDENT_INVITE,
      },
    });
  }
};

export const sendResidentInviteMail = async req => {
  const throwError = token => {
    throw new ServiceError({ token, status: 412 });
  };

  const { context, personIds = [], partyId, ...rest } = req.body;

  logger.trace({ ctx: req, ...req.body }, 'sendResidentInviteMail started!');

  if (!partyId) throwError('PARTY_ID_NOT_DEFINED');

  isUUID(partyId, 'INVALID_PARTY_ID');

  let partyPersonIds = personIds;
  if (!personIds.length) {
    partyPersonIds = ((await loadPartyMembers(req, partyId)) || []).map(({ personId }) => personId);
  }

  const { assignedPropertyId: propertyId } = await loadPartyById(req, partyId);

  const commonUsers = await getCommonUserByPersonIds(req, partyPersonIds);

  const { newRegistrationPersonIds, invitePersonIds, commonUsersToCreate } = getPersonIdsGroupedByTemplateType(partyPersonIds, commonUsers);

  commonUsersToCreate.length && (await createCommonUsersByPersonIds(req, commonUsersToCreate));

  const overridePersons = await overridePersonsWithContactInfo(req, partyPersonIds);
  const invitePersonsOverride = overridePersons.filter(({ id }) => invitePersonIds.includes(id));
  const newRegistrationPersonsOverride = overridePersons.filter(({ id }) => newRegistrationPersonIds.includes(id));

  await sendResidentCommMessage(req, {
    propertyId,
    partyId,
    context,
    newRegistrationPersonIds,
    invitePersonIds,
    invitePersonsOverride,
    newRegistrationPersonsOverride,
    rest,
  });

  logger.trace({ ctx: req, newRegistrationPersonIds, invitePersonIds }, 'sendResidentInviteMail finish!');

  return;
};
