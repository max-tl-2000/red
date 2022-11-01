/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import parseReplyPlainText from 'parse-reply';

// the format is '<messageGUID@asd.com>' -> we just need the messageGUID part
export const parseMessageId = message => {
  const matches = message && message.match('<(.*)@.*>');
  return matches ? matches[1] : message;
};

export const parseEmailMessage = (communication, communicationThread) => {
  const fullMessageText = communication.message.text || '';
  const newMessageText = parseReplyPlainText(fullMessageText);
  const isReplyMessage = communication.message.rawMessage && communication.message.rawMessage.inReplyTo;
  if (isReplyMessage) {
    const inReplyTo = communicationThread.find(comm => comm.messageId === parseMessageId(communication.message.rawMessage.inReplyTo));
    if (!inReplyTo) return fullMessageText;
    const inReplyToCommText = inReplyTo.message.text || '';
    const formattedInReplyToMessage = `> ${inReplyToCommText.replace(/[\n\r]/g, '\n> ')}`.trim();
    const isInlineReply = fullMessageText && !fullMessageText.includes(formattedInReplyToMessage);
    const displayReplyMessage = isInlineReply || !newMessageText ? fullMessageText : newMessageText;
    return displayReplyMessage;
  }
  return newMessageText;
};

export const parseTemplateVariables = (templateText, templateVariableValues) => {
  let replacedTemplate = templateText;
  const templateKeys = Object.getOwnPropertyNames(templateVariableValues);
  templateKeys.map(variableKey => {
    const stringToReplace = `%${variableKey}%`;
    replacedTemplate = replacedTemplate.replace(stringToReplace, templateVariableValues[variableKey]);
    return variableKey;
  });
  return replacedTemplate;
};
