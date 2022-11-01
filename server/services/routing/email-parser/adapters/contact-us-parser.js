/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseEmailParser, BASE_SEARCH_EXPRESSIONS } from './base-email-parser';
import { parseQualificationQuestions } from '../email-parser-helper';

export class ContactUsParser extends BaseEmailParser {
  constructor(key) {
    const settings = {
      emailsToProcess: [/^webinquiry@reva.tech$/, /^no[-]?reply@betterbot.(?:ai|com)$/, /^amber.referrals@amberstudent.com$/],
      searchExpressions: {
        senderEmail: BASE_SEARCH_EXPRESSIONS.senderEmail,
        senderPhone: BASE_SEARCH_EXPRESSIONS.senderPhone,
        senderName: /fullName:\s*(.*)/,
      },
      ilsSenderPatterns: [/^webinquiry@reva.tech$/, /^no[-]?reply@betterbot.(?:ai|com)$/, /^amber.referrals@amberstudent.com$/],
    };
    super(settings);
    this.providerName = key;
  }

  getQualificationQuestions = emailBody => {
    const qualifications = this.extractFields(emailBody, /qualification_([a-zA-Z]+):([^<\n]*)/g);
    const fnParseQualification = ([, key = '', value = '']) => ({
      key,
      value: this.extractFirstWord(value),
    });
    const questionsMap = qualifications.reduce(this.reduceFieldHandler(fnParseQualification), new Map());
    const groupProfiles = this.extractFields(emailBody, /groupProfile:([^<\n]*)/g);
    const fnParseGroupProfile = ([key = '', value = '']) => ({
      key: key.split(':').shift(),
      value: this.extractFirstWord(value),
    });
    const qualificationQuestionsMap = groupProfiles.reduce(this.reduceFieldHandler(fnParseGroupProfile), questionsMap);

    const qualificationQuestions = parseQualificationQuestions(qualificationQuestionsMap);
    return Object.keys(qualificationQuestions).length ? qualificationQuestions : undefined;
  };

  shouldProcessEmailBody = messageData => this._shouldProcessEmailBody(messageData);

  belongsToIlsDomain = messageData => this._belongsToIlsDomain(messageData);

  parseEmailInformation = ({ text }) => {
    const baseInformation = this._parseEmailInformation({ text });
    const qualificationQuestions = this.getQualificationQuestions(text);
    return {
      ...baseInformation,
      additionalFields: {
        qualificationQuestions,
      },
    };
  };
}
