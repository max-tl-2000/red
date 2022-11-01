/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser } from './base-email-parser';

export class YelpParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/^reply\+.{32}@messaging.yelp.com$/],
      searchExpressions: {
        // yelp does not have email and phone information in the email body, it uses anonymized emails
        senderName: [/New Message from\s*([^\n]*)/i, /([^\n]*) is interested in working with you/i],
      },
      ilsSenderPatterns: [/^.*(@|\.)messaging.yelp.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  getAnonymizedEmail = ({ from_email: fromEmail } = {}) => fromEmail || '';

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text, rawMessage, from }) => {
    const baseInformation = this._parseEmailInformation({ text });
    const anonymizedEmail = this.getAnonymizedEmail(rawMessage) || from;
    return {
      ...baseInformation,
      from: anonymizedEmail,
      contactInfo: {
        ...baseInformation.contactInfo,
        email: anonymizedEmail,
      },
    };
  };
}
