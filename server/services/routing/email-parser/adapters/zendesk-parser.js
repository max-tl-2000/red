/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser, BASE_SEARCH_EXPRESSIONS } from './base-email-parser';

export class ZendeskParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/\.*zendesk.com$/],
      searchExpressions: {
        senderEmail: BASE_SEARCH_EXPRESSIONS.senderEmail,
        senderPhone: /Contact Number:\s*([^<\n]*)/,
        senderName: /Visitor's Name:\s*(.*)/,
      },
      ilsSenderPatterns: [/^.*(@|\.)zendesk.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text }) => this._parseEmailInformation({ text });
}
