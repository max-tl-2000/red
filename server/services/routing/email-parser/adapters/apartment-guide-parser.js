/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser, BASE_SEARCH_EXPRESSIONS } from './base-email-parser';
import { replaceFromEmailWith } from '../email-parser-helper';

export class ApartmentGuideParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/\.*message.my.apartmentguide.com$/],
      searchExpressions: {
        senderEmail: BASE_SEARCH_EXPRESSIONS.senderEmail,
        senderPhone: BASE_SEARCH_EXPRESSIONS.senderPhone,
        senderName: /Information for\s*(.*)/,
      },
      ilsSenderPatterns: [/^.*(@|\.)message.my.apartmentguide.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  extractInformationFromNewFormat = (baseInformation, text) => {
    const firstName = this.extractValueFromMessage(text, /First Name:\s*([^<\n]*)/i);
    const lastName = this.extractValueFromMessage(text, /Last Name:\s*([^<\n]*)/i);
    const fromName = [firstName, lastName].filter(name => name).join(' ');
    return { ...baseInformation, fromName };
  };

  parseEmailInformation = ({ text, from }) => {
    let baseInformation = this._parseEmailInformation({ text });
    if (!this.isFullNameValid(baseInformation)) {
      baseInformation = this.extractInformationFromNewFormat(baseInformation, text);
    }
    // validate if the  fullName needs to be ignore when received from mobile - fallback email
    if (!this.isEmailValid(baseInformation)) {
      baseInformation.from = '';
    }
    return baseInformation.from ? baseInformation : replaceFromEmailWith(baseInformation, from);
  };
}
