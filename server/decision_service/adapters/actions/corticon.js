/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { patchEntity, postEntity } from '../../utils';
import CreateTask from './CreateTask';
import UpdateTask from './UpdateTask';
import tryParse from '../../../../common/helpers/try-parse';

const CORTICON_RESPONSE_PARTY_PATH = 'soap:Envelope.soap:Body[0].urn:CorticonResponse[0].WorkDocuments[0].Party[0]';

const ACTIONS = {
  CREATE_TASK: 'create_Task',
  UPDATE_TASK: 'update_Task',
  SCHEDULE_CUSTOM_EVENT: 'schedule_CustomEvent',
  SEND_COMM: 'create_Communication',
};

const tasksUrlPath = '/party/PARTY_ID/tasks';
const delayCustomEventUrlPath = '/party/PARTY_ID/delayedMessages';
const sendPartyComm = '/party/PARTY_ID/sendComm';

export const CORTICON_ACTIONS = {
  [ACTIONS.CREATE_TASK]: {
    actionFn: postEntity,
    actionPayloadType: CreateTask,
    actionIntegrationPath: tasksUrlPath,
    actionPath: `${CORTICON_RESPONSE_PARTY_PATH}.${ACTIONS.CREATE_TASK}`,
  },
  [ACTIONS.UPDATE_TASK]: {
    actionFn: patchEntity,
    actionPayloadType: UpdateTask,
    actionIntegrationPath: tasksUrlPath,
    actionPath: `${CORTICON_RESPONSE_PARTY_PATH}.${ACTIONS.UPDATE_TASK}`,
  },
  [ACTIONS.SCHEDULE_CUSTOM_EVENT]: {
    actionFn: postEntity,
    // instead of a class we can also provide a mapping function
    // that will receive the payload and the party document
    mapPayloadFn: data => ({
      customPayload: data.customPayload?.[0],
      delay: (data.numberOfSecondsDelay?.[0] || 0) * 1000 || 0,
      partyID: data.partyId, // why in this case the ID is capitalized?
      ruleName: data.ruleName?.[0],
    }),
    actionIntegrationPath: delayCustomEventUrlPath,
    actionPath: `${CORTICON_RESPONSE_PARTY_PATH}.${ACTIONS.SCHEDULE_CUSTOM_EVENT}`,
  },
  [ACTIONS.SEND_COMM]: {
    actionIntegrationPath: sendPartyComm,
    actionFn: postEntity,
    mapPayloadFn: (data, party) => {
      const personIds = (party?.members || []).map(member => member?.person?.id);
      const templateArgs = {};
      return {
        partyId: party?.id,
        personIds,
        templateArgs,
        communicationCategory: data.category?.[0],
        channel: data.channel?.[0],
        skipAgentNotification: tryParse(data.skipAgentNotification?.[0], false),
        templateName: data.template?.[0],
        messageType: '',
        userIdFrom: party?.userId,
      };
    },
    actionPath: `${CORTICON_RESPONSE_PARTY_PATH}.${ACTIONS.SEND_COMM}`,
  },
};

export const CORTICON_RESPONSE_ACTION_PATHS = Object.values(CORTICON_ACTIONS).map(a => a.actionPath);
