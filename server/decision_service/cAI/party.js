/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import v4 from 'uuid/v4';
import logger from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import sleep from '../../../common/helpers/sleep';
import { X_REQUEST_ID, X_ORIGINAL_REQUEST_IDS, X_DOCUMENT_VERSION, formatArrayHeaderValues } from '../../../common/enums/requestHeaders';
import config from '../config';
import { now, toMoment } from '../../../common/helpers/moment-utils';

const { publicLeasingAPIUrl: externalAPIPath } = config;

// TODO: This should be handle inside a provider or an adapter
const initRasaSession = async (ctx, data, token) => {
  const callBackUrl = ctx.body?.callBackUrl;
  logger.info({ ctx, ...data, callBackUrl }, 'initRasaSession started!');

  try {
    const { partyId, personId, person, contactInfo, communicationId, teamIds, assignedPropertyId, propertyDisplayName } = data;

    const phone = (contactInfo.find(({ type }) => type === DALTypes.ContactInfoType.PHONE) || {}).value;
    const email = (contactInfo.find(({ type }) => type === DALTypes.ContactInfoType.EMAIL) || {}).value;

    const entity = {
      init: [
        {
          partyId,
          propertyId: assignedPropertyId,
          propertyDisplayName,
          teamId: teamIds && teamIds[0],
          personDetails: { name: person.fullName, phone, email },
        },
      ],
    };
    const rasaConversationId = `${partyId}-${personId}`;
    const { domainUrl, conversationsUrlPrefix, newSessionMethod, intentName, authToken } = config.rasa;

    const initPayload = {
      name: intentName,
      entities: [entity],
    };

    logger.trace({ ctx, partyId, rasaInitPayload: initPayload }, 'initRasaSession payload');

    await request
      .post(`${domainUrl}${conversationsUrlPrefix}${rasaConversationId}${newSessionMethod}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${authToken}`)
      .send(initPayload);

    const newRequestId = v4();
    const url = `${callBackUrl || externalAPIPath}/communications`;
    logger.trace({ ctx, partyId, url, newRequestId }, 'updateCommunication');

    await request
      .patch(url)
      .set('Content-Type', 'application/json')
      .set(X_REQUEST_ID, newRequestId)
      .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
      .set(X_DOCUMENT_VERSION, ctx.documentVersion)
      .set('Authorization', `Bearer ${token}`)
      .send({
        delta: { message: { rasaConversationId } },
        communicationIds: [communicationId],
      });

    logger.info({ ctx, rasaConversationId }, 'initRasaSession finish!');
    return { rasaConversationId };
  } catch (ex) {
    logger.error({ ctx, ...data, error: ex }, 'initRasaSession failed!');
    return {};
  }
};

const enableCaiOnParty = async (ctx, { partyId, token, caiEnabled }) => {
  logger.info({ ctx, partyId }, 'enableCaiOnParty started!');
  const response = await request
    .patch(`${ctx.body?.callBackUrl || externalAPIPath}/party/${partyId}`)
    .set('Content-Type', 'application/json')
    .set(X_REQUEST_ID, v4())
    .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
    .set(X_DOCUMENT_VERSION, ctx.documentVersion)
    .set('Authorization', `Bearer ${token}`)
    .send({
      metadata: { caiEnabled },
    });
  logger.info({ ctx, error: response?.error, status: response?.status }, 'enableCaiOnParty finish!');
};

const isThereAnActiveFollowupTask = (task, threadId) =>
  task.metadata.threadId === threadId && task.name === DALTypes.TaskNames.SMS_CONVERSATION_FOLLOWUP && task.state === DALTypes.TaskStates.ACTIVE;

const createFollowupTask = async (ctx, data, token) => {
  const { partyId, personId, userId, threadId, tasks } = data;
  if (tasks && tasks.some(task => isThereAnActiveFollowupTask(task, threadId))) {
    logger.info({ ctx, tasks, threadId, partyId }, 'createFollowupTask - followup task is already created');
    return;
  }

  const callBackUrl = ctx.body?.callBackUrl;
  const newRequestId = v4();
  const url = `${callBackUrl || externalAPIPath}/party/${partyId}/tasks`;
  const task = {
    name: DALTypes.TaskNames.SMS_CONVERSATION_FOLLOWUP,
    category: DALTypes.TaskCategories.MANUAL,
    partyId,
    userIds: [userId],
    state: DALTypes.TaskStates.ACTIVE,
    dueDate: now().toDate(),
    metadata: {
      externalId: v4(),
      unique: true,
      personId,
      formatTitle: true,
      threadId,
    },
  };

  logger.trace({ ctx, partyId, url, newRequestId, task }, 'createFollowupTask started!');

  await request
    .post(url)
    .set('Content-Type', 'application/json')
    .set(X_REQUEST_ID, newRequestId)
    .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
    .set(X_DOCUMENT_VERSION, ctx.documentVersion)
    .set('Authorization', `Bearer ${token}`)
    .send(task);

  logger.info({ ctx }, 'createFollowupTask finished!');
  return;
};

const sendMessagesFromRasa = async (ctx, responses, data, token) => {
  const callBackUrl = ctx.body?.callBackUrl;
  logger.info({ ctx, responses, ...data, callBackUrl }, 'sendMessagesFromRasa started!');
  const { rasaConversationId, partyId, threadId, communicationContext, contactInfo } = data;
  const rasaMessageIds = [];

  for (let i = 0; i < responses.length; i++) {
    await sleep(3000); // Wait 3 seconds before sending the m essage
    const response = responses[i];

    if (response.text.trim() === 'fallback') {
      await createFollowupTask(ctx, data, token);
      await enableCaiOnParty(ctx, { partyId: data.partyId, token, caiEnabled: false });
      break;
    }

    const newRequestId = v4();
    const url = `${callBackUrl || externalAPIPath}/communications`;
    logger.trace({ ctx, partyId, url, newRequestId, text: response.text }, 'addCommunication cAI');

    const comm =
      (await request
        .post(url)
        .set('Content-Type', 'application/json')
        .set(X_REQUEST_ID, newRequestId)
        .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
        .set(X_DOCUMENT_VERSION, ctx.documentVersion)
        .set('Authorization', `Bearer ${token}`)
        .send({
          partyId,
          threadId,
          type: communicationContext.type,
          communicationCategory: communicationContext.category,
          recipients: { contactInfos: [contactInfo.find(({ value }) => value === communicationContext.message.from).id] },
          message: {
            content: response.text,
            rasaConversationId,
          },
        })) || {};
    rasaMessageIds.push(comm);
  }

  logger.info({ ctx }, 'sendMessagesFromRasa finished!');
  return rasaMessageIds;
};

const updateFollowupTask = async (ctx, { partyId, currentCommunication, tasks }, token) => {
  const { direction, threadId } = currentCommunication;
  if (direction !== DALTypes.CommunicationDirection.OUT) {
    logger.info({ ctx, partyId, currentCommunication }, 'updateFollowupTask - current communication is not an outbound');
    return;
  }

  const activeFollowupTask = tasks.find(task => isThereAnActiveFollowupTask(task, threadId));

  if (!activeFollowupTask) {
    logger.info({ ctx, partyId, tasks, threadId }, 'updateFollowupTask - there is not an active followup task');
    return;
  }

  const callBackUrl = ctx.body?.callBackUrl;
  const newRequestId = v4();
  const url = `${callBackUrl || externalAPIPath}/party/${partyId}/tasks`;
  const task = {
    id: activeFollowupTask.id,
    state: DALTypes.TaskStates.COMPLETED,
  };

  logger.trace({ ctx, partyId, url, newRequestId, task }, 'updateFollowupTask started!');

  await request
    .patch(url)
    .set('Content-Type', 'application/json')
    .set(X_REQUEST_ID, newRequestId)
    .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
    .set(X_DOCUMENT_VERSION, ctx.documentVersion)
    .set('Authorization', `Bearer ${token}`)
    .send(task);

  logger.info({ ctx }, 'updateFollowupTask finished!');
  return;
};

// TODO: This should be handle inside a provider or an adapter
const sendMessageToRasa = async (ctx, data, token) => {
  const { domainUrl, webhookUrl, authToken } = config.rasa;

  const payload = {
    sender: data?.rasaConversationId,
    message: data?.communicationContext?.message?.text,
  };

  logger.info({ ctx, ...data, rasaPayload: payload }, 'sendMessageToRasa started!');

  const response = await request
    .post(`${domainUrl}${webhookUrl}`)
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .send(payload);
  const responses = response.body;
  logger.info({ ctx, responses }, 'sendMessageToRasa finish!');

  responses.length && (await sendMessagesFromRasa(ctx, responses, data, token));
};

const filterCommsByDirection = (comms, commDirection) => comms.filter(({ direction }) => direction === commDirection);

const getLastSMSMessageFromThread = threadComms => {
  const threadOutComms = filterCommsByDirection(threadComms, DALTypes.CommunicationDirection.OUT).filter(
    ({ type }) => type === DALTypes.CommunicationMessageType.SMS,
  );

  const sortedThreadOutComms = threadOutComms.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)));
  return (sortedThreadOutComms.length && sortedThreadOutComms[0]?.message) || {};
};

export const handleCai = async ({ ctx, party, token }) => {
  logger.trace({ ctx, partyId: party.id, version: party.version }, 'Handle cAI for party');

  const {
    comms: partyComms,
    assignedPropertyId,
    id: partyId,
    metadata: { caiEnabled },
    tasks,
  } = party;

  const { communicationId, personIds = [], propertyDisplayName, teamIds, enableBotResponseOnCommunications, programId, tenantName } = party.events.find(
    ({ event }) => event === DALTypes.PartyEventType.COMMUNICATION_COMPLETED,
  )?.metadata;

  if (!tenantName || !tenantName.startsWith('demo')) {
    logger.info({ ctx, communicationId, programId, tenantName }, 'handleCai - cAI is not enabled at tenant level');
    return [];
  }

  if (!enableBotResponseOnCommunications) {
    logger.info({ ctx, communicationId, programId }, 'handleCai - cAI is not enabled at program level');
    return [];
  }

  if (!communicationId) {
    logger.warn({ ctx, partyId }, 'handleCai - communication not provided');
    return [];
  }

  const currentCommunication = partyComms.find(comm => comm.id === communicationId);

  if (caiEnabled === false) {
    await updateFollowupTask(ctx, { partyId, currentCommunication, tasks }, token);
    logger.info({ ctx, partyId, communicationId }, 'handleCai - cAI is not enabled on this party');
    return [];
  }

  if (currentCommunication.type !== DALTypes.CommunicationMessageType.SMS || currentCommunication.direction !== DALTypes.CommunicationDirection.IN) {
    logger.info({ ctx, partyId, communicationId }, "handleCai - communication is not SMS or it's an outbound");
    return [];
  }

  if (caiEnabled === undefined) {
    await enableCaiOnParty(ctx, { partyId, token, caiEnabled: true });
  }

  const personId = personIds.length && personIds[0];

  const memberIndex = party.members?.findIndex(m => m.person.id === personId);
  if (memberIndex < 0) {
    logger.info({ ctx, partyId, personId }, 'handleCai - person not found');
    return [];
  }

  const { person, contactInfo } = party.members[memberIndex];
  const currentThreadComms = partyComms.filter(({ threadId }) => threadId === currentCommunication.threadId);
  const rasaConversationId =
    getLastSMSMessageFromThread(currentThreadComms).rasaConversationId ||
    (
      await initRasaSession(
        ctx,
        {
          partyId,
          personId,
          person,
          contactInfo,
          communicationId,
          teamIds,
          assignedPropertyId,
          propertyDisplayName,
        },
        token,
      )
    ).rasaConversationId;

  if (!rasaConversationId) {
    logger.info({ ctx, partyId, communicationId }, 'handleCai - communication should not be handled by cAI');
    return [];
  }

  const rasaMessageIds = await sendMessageToRasa(
    ctx,
    {
      rasaConversationId,
      message: currentCommunication.message,
      partyId,
      threadId: currentCommunication.threadId,
      communicationContext: currentCommunication,
      contactInfo,
      userId: party.userId,
      tasks,
    },
    token,
  );

  logger.trace({ ctx, partyId, version: party.version, rasaMessageIds }, 'Handle cAI for party finish');

  return rasaMessageIds;
};
