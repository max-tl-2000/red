/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const TransferTargetType = {
  TEAM: 'team',
  USER: 'user',
  EXTERNAL_PHONE: 'external_phone',
};

export const ConferenceEvents = {
  ENTER: 'ConferenceEnter',
  RECORD_STOP: 'ConferenceRecordStop',
  HANGUP: 'Hangup',
  START_APP: 'StartApp',
};

export const ConferenceActions = {
  RECORD: 'record',
  EXIT: 'exit',
};

export const DialActions = {
  HANGUP: 'hangup',
  ANSWER: 'answer',
};

export const DialStatus = {
  NO_ANSWER: 'no-answer',
  BUSY: 'busy',
  CANCEL: 'cancel',
  COMPLETED: 'completed',
};

export const CallStatus = {
  NO_ANSWER: 'no-answer',
  RINGING: 'ringing',
  COMPLETED: 'completed',
  IN_PROGRESS: 'in-progress',
  BUSY: 'busy',
  FAILED: 'failed',
};

export const HangupCauseName = {
  BUSY_LINE: 'Busy Line',
  REJECTED: 'Rejected',
  NO_HANGUP: '',
};
