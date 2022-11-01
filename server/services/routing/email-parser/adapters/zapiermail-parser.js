/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser } from './base-email-parser';
import { isEmailValid } from '../../../../../common/helpers/validations';
import { isValidPhoneNumber } from '../../../../helpers/phoneUtils';

const generateSearchExpression = lineNumber => new RegExp(`facebook ad:\\n(?:.*\\n?){${lineNumber}}?([^\\n]*)`, 'i');

export class ZapiermailParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/\.*zapiermail.com$/, /^leads@digible.com$/],
      searchExpressions: {
        senderName: generateSearchExpression(0),
        senderEmail: generateSearchExpression(2),
        senderPhone: generateSearchExpression(3),
      },
      ilsSenderPatterns: [/^.*(@|\.)zapiermail.com$/, /^.*(@|\.)digible.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text }) => {
    let lastName = this.extractValueFromMessage(text, generateSearchExpression(1));
    // when the sender name is just in one line therefore the second line is the email or phone
    const thereIsContactInfoInSecondLine = lastName && (isEmailValid(lastName) || isValidPhoneNumber(lastName));
    const lastDataIndex = thereIsContactInfoInSecondLine ? 2 : 3;
    lastName = thereIsContactInfoInSecondLine ? null : lastName;

    const isEmailInTheLastLine = isEmailValid(this.extractValueFromMessage(text, generateSearchExpression(lastDataIndex)));
    this.settings.searchExpressions.senderEmail = generateSearchExpression(isEmailInTheLastLine ? lastDataIndex : lastDataIndex - 1);
    this.settings.searchExpressions.senderPhone = generateSearchExpression(isEmailInTheLastLine ? lastDataIndex - 1 : lastDataIndex);

    const { fromName, ...restProperties } = this._parseEmailInformation({ text });

    return {
      ...restProperties,
      fromName: lastName ? `${fromName} ${lastName}` : fromName,
    };
  };
}
