/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser } from './base-email-parser';
import { containsValidContactName } from '../../../../../common/regex';

export class ZumperParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/\.*zlead.co$/, /\.*zumper.com/],
      searchExpressions: {
        /* Sample matching strings:
          123-456-7890
          (123) 456-7890
          123 456 7890
          123.456.7890
          +91 (123) 456-7890
          +19257261723
        */
        senderPhone: /(((\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})|(\+?\d{11,15}))/,
      },
      ilsSenderPatterns: [/^.*(@|\.)zlead.co$/, /^.*(@|\.)zumper.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  // Returns an object with this form { name: 'michael smigdol', address : 'michael@migdol.net' }
  extractReplyToAddressAndNameFromHeaders = ({ headers } = {}) => {
    if (!headers) return {};

    const replyTo = headers['reply-to'] || { value: [] };
    const { address = '' } = replyTo.value[0];
    return { nameFromReplyTo: this.getSanitizedContactName(replyTo.value[0].name), address };
  };

  getSanitizedContactName = (contactName = '') => contactName.split(' ').filter(containsValidContactName).join(' ');

  parseEmailInformation = ({ text, rawMessage = {} }) => {
    let nameFromHtmlBody = '';
    if (rawMessage.html) {
      const contactInfoSelector = 'table tr:nth-child(3) p:nth-child(2)';
      const contactInfoReplyLinkSelector = `${contactInfoSelector} a:contains("Reply to lead")`;

      const contactInfoHtml = this.getHtmlText(rawMessage.html, contactInfoSelector);

      const isExpectedEmailTemplate = this.getHtmlText(rawMessage.html, contactInfoReplyLinkSelector);
      if (isExpectedEmailTemplate) nameFromHtmlBody = this.getTextFromHtmlElement(contactInfoHtml);
    }

    const baseInformation = this._parseEmailInformation({ text });
    const { nameFromReplyTo = '', address = '' } = this.extractReplyToAddressAndNameFromHeaders(rawMessage);
    return {
      ...baseInformation,
      from: address || baseInformation.from,
      fromName: nameFromHtmlBody || nameFromReplyTo || baseInformation.from,
      contactInfo: {
        ...baseInformation.contactInfo,
        email: address,
      },
    };
  };
}
