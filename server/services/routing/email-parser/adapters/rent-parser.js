/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser, BASE_SEARCH_EXPRESSIONS } from './base-email-parser';
import { replaceFromEmailWith } from '../email-parser-helper';

export class RentParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/\.*email.rent.com$/],
      searchExpressions: {
        senderEmail: BASE_SEARCH_EXPRESSIONS.senderEmail,
        senderPhone: BASE_SEARCH_EXPRESSIONS.senderPhone,
        senderName: /Information for\s*(.*)/,
      },
      ilsSenderPatterns: [/^.*(@|\.)email.rent.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text, from }) => {
    const baseInformation = this._parseEmailInformation({ text });
    return baseInformation.from ? baseInformation : replaceFromEmailWith(baseInformation, from);
  };
}
