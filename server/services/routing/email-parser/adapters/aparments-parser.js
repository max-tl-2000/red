/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser, BASE_SEARCH_EXPRESSIONS } from './base-email-parser';

export class ApartmentsParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/^lead@apartments.com$/, /^interests@apartmentlist.com$/],
      searchExpressions: {
        senderEmail: BASE_SEARCH_EXPRESSIONS.senderEmail,
        senderPhone: BASE_SEARCH_EXPRESSIONS.senderPhone,
        senderName: [/(?:Meet|Name:)\s+(.*)/, /(?:New Lead from|Hot Lead from)\s+(.*)\s\*/, /\*\s*(.*)\s+is\s+(.*)(ready|at|in)\s+[0-9A-Z]/i],
      },
      ilsSenderPatterns: [/^.*(@|\.)apartments.com$/i, /^.*(@|\.)apartmentlist.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text }) => this._parseEmailInformation({ text });
}
