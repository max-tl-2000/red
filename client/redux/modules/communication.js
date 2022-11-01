/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const UPDATE_COMMUNICATIONS_FAIL = 'communication/UPDATE_COMMUNICATIONS_FAIL';
const PRINT_COMMUNICATION_REQUEST = 'print-communication-request';
const PRINT_COMMUNICATION_SUCCESS = 'print-communication-success';
const PRINT_COMMUNICATION_FAILURE = 'print-communication-failure';

import { refreshInactiveCallFlyouts } from 'redux/modules/telephony';
import notifier from 'helpers/notifier/notifier';
// import { now, DATE_TIME_ISO_FORMAT } from '../../../common/helpers/moment-utils';
// import { logger } from '../../../common/client/logger';
import * as dataStoreActions from './dataStore';
import { updateFlyout } from './flyoutStore';

const initialState = {};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case UPDATE_COMMUNICATIONS_FAIL: {
      return {
        ...state,
        communicationError: action.error.token,
      };
    }
    case PRINT_COMMUNICATION_REQUEST:
    case PRINT_COMMUNICATION_SUCCESS:
    case PRINT_COMMUNICATION_FAILURE:
      return state;

    default:
      return state;
  }
}

export const sendMessage = (recipients, message, type, partyId, inReplyTo, quote, templateData, threadId, html = null) => {
  // there is an engineering story created to return only status codes from POST
  // and update clients only through web sockets
  const formatter = comms => ({ communications: [...comms] });
  const data = {
    recipients,
    message,
    type,
    partyId,
    inReplyTo,
    quote,
    templateData,
    threadId,
    isHtmlContent: !!html,
    html,
  };

  // logger.trace({ data, clientSendingTime: now().format(DATE_TIME_ISO_FORMAT), shouldPostToServer: true }, 'sendEmailMessageFromClient');

  const { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } = dataStoreActions;
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client => client.post('/communications', { data }),
    partyId,
  };
};

export const saveContactEvent = data => {
  const formatter = comms => ({ communications: [...comms] });
  const { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } = dataStoreActions;
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client => client.post('/communications', { data }),
    partyId: data.partyId,
  };
};

export const updateThreadIdForSms = (flyoutId, personIds) => async (makeRequest, dispatch) => {
  const { data: threadId, error } = await makeRequest({
    method: 'POST',
    url: '/communications/sms/computeThreadId',
    payload: { personIds },
  });

  if (error) {
    console.error('unable to get sms threadId', error);
    return;
  }

  await dispatch(updateFlyout(flyoutId, { threadId }));
};

const updateCommunications = ({ query, bodyFilters = {}, delta }) => async (makeRequest, dispatch, getState) => {
  const { UPDATE_DATA_SUCCESS } = dataStoreActions;
  const queryString = query ? `?${query}` : '';
  const { data: comms, error } = await makeRequest({
    method: 'PATCH',
    url: `/communications${queryString}`,
    payload: { delta, ...bodyFilters },
  });
  if (error) {
    error.__handled = true;
    await dispatch({ type: UPDATE_COMMUNICATIONS_FAIL, error });
    return;
  }
  if (comms.length) {
    await dispatch({ type: UPDATE_DATA_SUCCESS, result: { communications: comms } });
    refreshInactiveCallFlyouts(comms, dispatch, getState);
  }
};

export const updateCommunicationsByCommunicationId = (commId, delta) => updateCommunications({ query: `id=${commId}`, delta });

export const updateCommunicationsByIds = (communicationIds, delta) => updateCommunications({ bodyFilters: { communicationIds }, delta });

export const commsReadByUser = threadId => async (makeRequest, dispatch) => {
  const { UPDATE_DATA_SUCCESS } = dataStoreActions;

  const { data: comms, error } = await makeRequest({
    method: 'PATCH',
    url: `/communications/thread/${threadId}/markAsRead`,
  });

  if (error) {
    console.error(`Failed to mark the communications with threadId: ${threadId} as read`);
    return;
  }

  if (comms.length) {
    await dispatch({ type: UPDATE_DATA_SUCCESS, result: { communications: comms } });
  }
};

export const sendCommunication = (partyId, { templateId, templateName, personIds, context, templateDataOverride, templateArgs, communicationCategory }) => {
  const formatter = result =>
    result.reduce(
      (acc, current) => {
        acc.communications = [...acc.communications, ...current.communications];
        return acc;
      },
      { communications: [] },
    );

  const data = {
    templateId,
    templateName,
    personIds,
    context,
    templateDataOverride,
    templateArgs,
    category: communicationCategory,
  };

  const { UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } = dataStoreActions;

  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client => client.post(`/communications/${partyId}/sendCommunication`, { data }),
    partyId,
  };
};

export const logPrintAction = ({ communication, fullName } = {}) => async (makeRequest, dispatch) => {
  dispatch({ type: PRINT_COMMUNICATION_REQUEST });

  const dataToSend = {
    partyId: communication.parties[0],
    commId: communication.id,
    commType: communication.type,
    created_at: communication.created_at,
    from: fullName || communication.message?.from,
    direction: communication.direction,
    userId: communication.userId,
  };

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/log/print/communication',
    payload: {
      ...dataToSend,
    },
  });

  if (error) {
    dispatch({ type: PRINT_COMMUNICATION_FAILURE, error });
  } else {
    dispatch({ type: PRINT_COMMUNICATION_SUCCESS, result: data });
  }
};

export const markCommsAsReadForParty = partyId => async (makeRequest, dispatch) => {
  const { UPDATE_DATA_SUCCESS } = dataStoreActions;

  const { data: comms, error } = await makeRequest({
    method: 'PATCH',
    url: `/communications/party/${partyId}/markAsRead`,
  });

  if (error) {
    const message = `Failed to mark all the communications with partyId: ${partyId} as read`;
    console.error(message);
    notifier.error(message);
    return;
  }

  if (comms.length) {
    await dispatch({ type: UPDATE_DATA_SUCCESS, result: { communications: comms } });
  }
};
