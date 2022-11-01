/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser } from './base-email-parser';
import { getIlsEmailFromHeaders } from '../email-parser-helper';

export class ForRentParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/^guestcards@forrent.com$/],
      searchExpressions: {
        senderEmail: /mailto:([^"]*)/,
        senderPhone: /<br\/?>\s*([^<]*)/,
        senderName: />([^<]*)/,
      },
      ilsSenderPatterns: [/^.*(@|\.)forrent.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => {
    const ilsEmail = getIlsEmailFromHeaders(messageData.rawMessage);
    return this._shouldProcessEmailBody(messageData, ilsEmail ? [ilsEmail] : []);
  };

  belongsToIlsDomain = messageData => {
    const ilsEmail = getIlsEmailFromHeaders(messageData.rawMessage);
    return this._belongsToIlsDomain(messageData, ilsEmail ? [ilsEmail] : []);
  };

  extractInformationFromText = text => {
    this.settings.searchExpressions = {
      senderEmail: /\[Email\]\s*([^\s<\n]*)/,
      senderPhone: /\[Phone\]\s*([^<\n]*)/,
      senderName: /\[Prospect Name\]\s*(.*)/,
    };
    return this._parseEmailInformation({ text });
  };

  parseEmailInformation = ({ text, rawMessage }) => {
    if (!rawMessage.html) return this.extractInformationFromText(text);

    const context = this.getHtmlText(rawMessage.html, `${'table '.repeat(5)} tr:nth-child(4) ${'table '.repeat(3)}`);
    if (!context) return this.extractInformationFromText(text);

    const { from, ...restProperties } = this._parseEmailInformation({ text: context });
    let phoneContext = this.getHtmlText(context, 'tr:nth-child(5)') || '';
    // in some cases the email template has a link around the phone information
    if (phoneContext.includes('</a></td>')) {
      this.settings.searchExpressions.senderPhone = /.*/;
      phoneContext = this.getHtmlText(phoneContext, 'a:not([href])') || '';
    }

    return {
      ...restProperties,
      from,
      fromName: this.getSenderNameFromMessage({ text: this.getHtmlText(context, 'tr:nth-child(3)') || '' }),
      contactInfo: {
        ...restProperties.contactInfo,
        phone: this.getSenderPhoneFromMessage({ text: phoneContext }),
      },
    };
  };
}
