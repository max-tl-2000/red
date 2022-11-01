/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import cheerio from 'cheerio';
import { isEmailValid } from '../../../../../common/helpers/validations/email';
import { formatPhoneNumberForDb, isValidPhoneNumber } from '../../../../helpers/phoneUtils';
import trim from '../../../../../common/helpers/trim';
import { isRegExp } from '../../../../../common/helpers/type-of';
import { DALTypes } from '../../../../../common/enums/DALTypes';

export const BASE_SEARCH_EXPRESSIONS = {
  senderEmail: /Email(?:\sAddress?)?\s*:\s*([^\s<\n]*)/i,
  senderPhone: /Phone(?:\sNumber?)?\s*:\s*([^<\n]*)/i,
  senderName: /Name:\s*(.*)/i,
};

export class BaseEmailParser {
  constructor(settings = {}) {
    this.settings = settings;
  }

  assertSearchExpressions = (email, settingName, assertFunc) => {
    if (!settingName) return false;

    const searchExpressions = this.settings[settingName];
    if (!searchExpressions || !searchExpressions.length) return false;
    return searchExpressions.some(searchExpression => assertFunc && assertFunc(searchExpression, trim(email)));
  };

  getEmailsToVerify = ({ from, rawMessage = {} }) => {
    const { from_email: fromEmail } = rawMessage;
    return [from, ...(fromEmail ? [fromEmail] : [])];
  };

  _shouldProcessEmailBody = (messageData, additionalEmails = []) => {
    const isIlsEmail = email => this.assertSearchExpressions(email, 'emailsToProcess', (expression, value) => isRegExp(expression) && expression.test(value));
    const emails = [...this.getEmailsToVerify(messageData), ...additionalEmails];
    return emails.some(isIlsEmail);
  };

  _belongsToIlsDomain = (messageData, additionalEmails = []) => {
    const isEmailOnIlsDomain = email =>
      this.assertSearchExpressions(email, 'ilsSenderPatterns', (expression, value) => isRegExp(expression) && expression.test(value));
    const emails = [...this.getEmailsToVerify(messageData), ...additionalEmails];
    return emails.some(isEmailOnIlsDomain);
  };

  _parseEmailInformation = ({ text }) => ({
    from: this.getSenderEmailFromMessage({ text }),
    fromName: this.getSenderNameFromMessage({ text }),
    contactInfo: {
      phone: this.getSenderPhoneFromMessage({ text }),
      email: this.getSenderEmailFromMessage({ text }),
    },
  });

  isEmailValid = baseInformation => baseInformation.contactInfo.email && baseInformation.contactInfo.email !== DALTypes.CommunicationIgnoreFields.EMAIL;

  isFullNameValid = baseInformation => baseInformation.fromName && baseInformation.fromName !== DALTypes.CommunicationIgnoreFields.FULLNAME;

  extractValueFromMessage = (text, searchExpression, extractFunc) => {
    const expressions = Array.isArray(searchExpression) ? searchExpression : [searchExpression];
    let fieldExtracted = '';
    expressions.some(exp => {
      const extractedValues = text.match(exp) || [];
      const [, valueExtracted = ''] = extractedValues;
      fieldExtracted = trim(extractFunc ? extractFunc(extractedValues) : valueExtracted);
      return !!fieldExtracted;
    });
    return fieldExtracted;
  };

  getSenderPhoneFromMessage = ({ text: emailBodyText }) =>
    this.extractValueFromMessage(emailBodyText, this.settings.searchExpressions.senderPhone, extractedValues => {
      const [phoneExtracted = '', phoneExtractedValue = ''] = extractedValues;
      const senderPhone = trim(isValidPhoneNumber(trim(phoneExtracted)) ? phoneExtracted : phoneExtractedValue);
      return formatPhoneNumberForDb(senderPhone);
    });

  getSenderNameFromMessage = ({ text: emailBodyText }) => {
    const fromName = this.extractValueFromMessage(emailBodyText, this.settings.searchExpressions.senderName);
    return fromName || DALTypes.CommunicationIgnoreFields.FULLNAME;
  };

  getSenderEmailFromMessage = ({ text: emailBodyText }) =>
    this.extractValueFromMessage(emailBodyText, this.settings.searchExpressions.senderEmail, extractedValues => {
      let [, email] = extractedValues;
      email = trim(email);
      return isEmailValid(email) ? email : DALTypes.CommunicationIgnoreFields.EMAIL;
    });

  extractFirstWord = sentence => trim(sentence).split(/\s+/).shift();

  extractFields = (emailBody, searchExpression) => {
    let fieldExtracted;
    const fields = [];
    // eslint-disable-next-line no-cond-assign
    while ((fieldExtracted = searchExpression.exec(emailBody))) {
      fields.push(fieldExtracted);
    }
    return fields;
  };

  reduceFieldHandler = fnParseField => (acc, field) => {
    const { key, value } = fnParseField(field);
    if (!key) return acc;
    acc.set(key, value);
    return acc;
  };

  getHtmlText = (receivedHtml, selector) => {
    if (!receivedHtml) return undefined;

    try {
      const $ = cheerio.load(`<div class="__cheerio_root__">${receivedHtml}</div>`);
      return $(`.__cheerio_root__ ${selector}`).html();
    } catch (err) {
      return undefined;
    }
  };

  getTextFromHtmlElement = html => {
    if (!html) return undefined;

    try {
      const $ = cheerio.load(`<div class="__cheerio_root__">${html}</div>`);
      return $('.__cheerio_root__').children().remove().end().text().trim();
    } catch (err) {
      return undefined;
    }
  };
}
