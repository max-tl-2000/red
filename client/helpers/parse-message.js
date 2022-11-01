/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const parseMessage = (message = {}) => {
  const rawMessage = message.rawMessage || {};
  const html = message.html || rawMessage.html;
  const text = message.text || rawMessage.text;
  const subject = message.subject || rawMessage.subject;

  return { html, text, subject };
};
