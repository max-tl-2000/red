/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser } from './base-email-parser';

export class FoundationHomesParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/^no-reply@wufoo.com$/],
      searchExpressions: {
        // We are not going to extract neither email and phone because the content is fairly unstructured
        senderName: /\(?First and Last\)?:[(\r?\n|\s|*)]*([^\n].*)/i,
      },
      ilsSenderPatterns: [/^.*(@|\.)wufoo.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text }) => {
    const { fromName = '', ...restProperties } = this._parseEmailInformation({ text });
    // We only get the first two words because sometimes we get more than one lead name in the sender name field.[e.g, Kate Roberts and Lou Gerstner]
    return {
      ...restProperties,
      fromName: fromName.replace(/,/g, ' ').split(/\s+/).slice(0, 2).join(' '),
    };
  };
}
