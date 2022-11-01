/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser, BASE_SEARCH_EXPRESSIONS } from './base-email-parser';

export class RespageParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/\.*respage.com$/],
      searchExpressions: {
        senderEmail: BASE_SEARCH_EXPRESSIONS.senderEmail,
        senderName: BASE_SEARCH_EXPRESSIONS.senderName,
      },
      ilsSenderPatterns: [/^.*(@|\.)respage.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text }) => this._parseEmailInformation({ text });
}
