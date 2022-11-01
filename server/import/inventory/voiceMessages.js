/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import difference from 'lodash/difference';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { DALTypes } from '../../../common/enums/DALTypes';
import { saveVoiceMessage, getMenuItems } from '../../dal/voiceMessageRepo';
import { getMenuItemNames, shouldRecordAfterMessage } from '../../services/telephony/voiceMessages';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const INVALID_VOICEMAIL = 'Invalid voicemail message format';
const MISSING_RECORD_TOKEN = 'Voicemail message should contain record token: [record]';
const INCLUDES_KEY_HOLDERS = 'Message shold not include key holders: ';
const INVALID_VOICE_MESSAGE = 'Invalid message format';
const UNDEFINED_KEY_HOLDER = 'Message contains key holders that are not defined in the VoiceMessageItems: ';
const INVALID_NAME = 'Invalid name';
const DUPLICATE_NAME = 'Name is used more than once';
const INVALID_RECORDING_NOTICE = 'Invalid recording notice';

const voiceMessagesRequiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'afterHours',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Text2KB,
  },
  {
    fieldName: 'unavailable',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'voicemail',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'callBackRequestAck',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'callQueueWelcome',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'callQueueUnavailable',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'callQueueClosing',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'callRecordingNotice',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'holdingMusic',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
];

const validateVoicemail = messages => {
  const voicemailMessage = messages.voicemail.toString().trim();
  const hasRecordToken = shouldRecordAfterMessage(voicemailMessage);
  const keyHolders = getMenuItemNames(voicemailMessage);
  const validationErrors = [];

  if (!hasRecordToken) {
    validationErrors.push({
      name: INVALID_VOICEMAIL,
      message: MISSING_RECORD_TOKEN,
    });
  }
  if (keyHolders.length) {
    validationErrors.push({
      name: INVALID_VOICEMAIL,
      message: `${INCLUDES_KEY_HOLDERS}${keyHolders}`,
    });
  }
  return validationErrors;
};

const validateRecordingNotice = messages => {
  const recordingNotice = messages.callRecordingNotice.toString().trim();
  const hasRecordToken = shouldRecordAfterMessage(recordingNotice);
  const keyHolders = getMenuItemNames(recordingNotice);

  if (hasRecordToken || keyHolders.length) {
    return [
      {
        name: INVALID_RECORDING_NOTICE,
        message: `${INCLUDES_KEY_HOLDERS}${keyHolders}`,
      },
    ];
  }
  return [];
};

const messageValidation = (message, dbKeyHolders) => {
  const msg = message.toString().trim();
  const keyHolders = getMenuItemNames(msg);
  const undefinedKeys = difference(keyHolders, dbKeyHolders);
  const validationErrors = [];

  if (undefinedKeys.length) {
    validationErrors.push({
      name: INVALID_VOICE_MESSAGE,
      message: `${UNDEFINED_KEY_HOLDER} ${undefinedKeys}`,
    });
  }
  return validationErrors;
};

const messagesValidation = (importMessages, dbKeyHolders) => {
  const { VoiceMessageType } = DALTypes;
  const IVRMessageTypes = [
    VoiceMessageType.AFTER_HOURS,
    VoiceMessageType.UNAVAILABLE,
    VoiceMessageType.CALL_BACK_REQUEST_ACK,
    VoiceMessageType.CALL_QUEUE_WELCOME,
    VoiceMessageType.CALL_QUEUE_UNAVAILABLE,
    VoiceMessageType.CALL_QUEUE_CLOSING,
    VoiceMessageType.RECORDING_NOTICE,
  ];
  const messages = IVRMessageTypes.map(m => importMessages[m] || '');
  let validationErrors = [];
  messages.forEach(m => {
    validationErrors = validationErrors.concat(messageValidation(m, dbKeyHolders));
  });
  return validationErrors;
};

const nameValidation = (menuItem, importMessageNames) => {
  const messageName = menuItem.name.toString().trim();
  const identicNames = importMessageNames.filter(n => n === messageName);
  if (identicNames.length > 1) {
    return [
      {
        name: INVALID_NAME,
        message: DUPLICATE_NAME,
      },
    ];
  }
  return [];
};

const customValidation = (menuItem, dbKeyHolders, importMessageNames) => [
  ...validateVoicemail(menuItem),
  ...validateRecordingNotice(menuItem),
  ...messagesValidation(menuItem, dbKeyHolders),
  ...nameValidation(menuItem, importMessageNames),
];

export const importVoiceMessages = async (ctx, rows) => {
  const importMessageNames = rows.map(i => i.data.name.toString().trim());
  const dbMenuItems = await getMenuItems(ctx);
  const dbKeyHolders = dbMenuItems.map(i => i.name);

  const invalidFields = await validate(
    rows,
    {
      requiredFields: voiceMessagesRequiredFields,
      async onValidEntity(message) {
        await saveVoiceMessage(ctx, message);
      },
      customCheck(message) {
        return customValidation(message, dbKeyHolders, importMessageNames);
      },
    },
    ctx,
    spreadsheet.VoiceMessages.columns,
  );

  return {
    invalidFields,
  };
};
