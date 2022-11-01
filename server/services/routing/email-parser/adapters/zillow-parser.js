/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser } from './base-email-parser';
import { isObject } from '../../../../../common/helpers/type-of.js';
import { getIlsEmailFromHeaders } from '../email-parser-helper';
import { DALTypes } from '../../../../../common/enums/DALTypes';

export class ZillowParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/^rentalclientservices@zillowrentals.com$/],
      searchExpressions: {
        senderPhone: /([\d\.]+)\s*Your listing\n/, // eslint-disable-line no-useless-escape
        senderName: [/New Contact\s*([A-Za-z\d\s'-–—]+)\sis interested/, /New Contact\s*([A-Za-z\d\s'-–—]+)\ssays:/],
        senderEmail: /([a-z0-9](\.?[a-z0-9+_-]){0,}@([a-z0-9_-]+\.){1,}([a-z]{2,4}))\s*([\d\.]+)*\s*Your listing\n/, // eslint-disable-line no-useless-escape
      },
      ilsSenderPatterns: [/^.*(@|\.)zillowrentals.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  extractReplyToAddressFromHeaders = ({ headers } = {}) => {
    if (!headers) return '';

    const replyTo = headers['reply-to'] || '';
    if (replyTo && isObject(replyTo)) return replyTo.text || '';

    return replyTo;
  };

  shouldProcessEmailBody = messageData => {
    const ilsEmail = getIlsEmailFromHeaders(messageData.rawMessage);
    return this._shouldProcessEmailBody(messageData, ilsEmail ? [ilsEmail] : []);
  };

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  getSender = (baseInformation, emailFromHeader) => {
    if (!baseInformation.contactInfo.email || baseInformation.contactInfo.email === DALTypes.CommunicationIgnoreFields.EMAIL) {
      return emailFromHeader || baseInformation.from;
    }
    return baseInformation.from;
  };

  parseEmailInformation = ({ text, rawMessage = {} }) => {
    const baseInformation = this._parseEmailInformation({ text });
    const email = this.extractReplyToAddressFromHeaders(rawMessage);

    return {
      ...baseInformation,
      from: this.getSender(baseInformation, email),
      contactInfo: {
        ...baseInformation.contactInfo,
        email: baseInformation.contactInfo.email || email,
      },
    };
  };
}
