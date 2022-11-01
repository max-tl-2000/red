/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser } from './base-email-parser';

export class RentBitsParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/^noreply@rentbits.io$/],
      searchExpressions: {
        // due to the text content is not possible to use regex. we will use cheerio.
      },
      ilsSenderPatterns: [/^.*(@|\.)rentbits.io$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ from, fromName, rawMessage = {} }) => {
    let senderName = '';
    let senderEmail = '';
    if (rawMessage.html) {
      const contextContactInfoSelector = 'div>table table tr:nth-child(2) li>ul>li';
      const contactInfoSelector = `${contextContactInfoSelector} p:nth-child(5)`;

      const contextLeadInformation = this.getHtmlText(rawMessage.html, contactInfoSelector);
      const contextEmailinfo = this.getHtmlText(contextLeadInformation, 'span');
      senderName = this.getTextFromHtmlElement(contextLeadInformation);
      senderEmail = this.getTextFromHtmlElement(contextEmailinfo);
    }

    return {
      from: senderEmail || from,
      fromName: senderName || fromName,
      contactInfo: {
        email: senderEmail || from,
      },
    };
  };
}
