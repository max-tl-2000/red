/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const START_SENDING_MESSAGE = 'sendMailDialog/START_SENDING_MESSAGE';
const END_SENDING_MESSAGE = 'sendMailDialog/END_SENDING_MESSAGE';

const initialState = {
  isOpen: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case START_SENDING_MESSAGE:
      return {
        ...state,
        isOpen: true,
        recipientPartyMembers: action.recipientPartyMembers,
        messageType: action.messageType,
      };
    case END_SENDING_MESSAGE:
      return {
        ...state,
        isOpen: false,
      };
    default:
      return state;
  }
}

export function startSendingMessage(recipientPartyMembers, type) {
  return {
    type: START_SENDING_MESSAGE,
    recipientPartyMembers,
    messageType: type,
  };
}

export function endSendingMessage() {
  return {
    type: END_SENDING_MESSAGE,
  };
}
