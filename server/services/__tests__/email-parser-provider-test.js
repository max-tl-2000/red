/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getEmailParserProvider } from '../routing/email-parser/email-parser-provider';
import { formatPhoneNumberForDb } from '../../helpers/phoneUtils';
import apartments from './email-parser/apartments.json';
import apartmentSearch from './email-parser/apartment-search.json';
import contactUs from './email-parser/contact-us.json';
import contactUsWithoutQualificationQuestions from './email-parser/contact-us-without-qq.json';
import forRent from './email-parser/for-rent.json';
import respage from './email-parser/respage.json';
import yelp from './email-parser/yelp.json';
import zendesk from './email-parser/zendesk.json';
import zillow from './email-parser/zillow.json';
import zillowReplyToAsObject from './email-parser/zillow-reply-to-as-object.json';
import zillow2 from './email-parser/zillow-2.json';
import zillow3 from './email-parser/zillow-3.json';
import zumper from './email-parser/zumper.json';
import { DALTypes } from '../../../common/enums/DALTypes';

const getParsedInformation = async messageData => {
  const provider = getEmailParserProvider(messageData);
  const parsedInformation = provider.parseEmailInformation(messageData);
  if (parsedInformation.from === DALTypes.CommunicationIgnoreFields.EMAIL) parsedInformation.from = null;
  if (parsedInformation.fromName === DALTypes.CommunicationIgnoreFields.FULLNAME) parsedInformation.fromName = null;
  return { ...parsedInformation, provider };
};

describe('Email parser provider', () => {
  const getMessageDataForProvider = (
    rawData,
    includeEmail = true,
    { emailExpression = '', replaceInHtml = false, emailInHeaders = false, replyTo = '' } = {},
  ) => {
    const messageData = {
      ...rawData,
      headers: (rawData.rawMessage || {}).headers || {},
      rawMessage: rawData.rawMessage || {},
    };
    if (includeEmail || !(emailExpression || emailInHeaders)) {
      return messageData;
    }

    const htmlExpression = new RegExp(emailExpression, 'gm');

    if (emailInHeaders) {
      const headers = {
        ...rawData.rawMessage.headers,
        'reply-to': replyTo,
      };
      return {
        ...messageData,
        text: emailExpression ? messageData.text.replace(emailExpression, '') : messageData.text,
        headers,
        rawMessage: {
          ...rawData.rawMessage,
          headers,
        },
      };
    }

    return {
      ...messageData,
      text: messageData.text.replace(emailExpression, ''),
      rawMessage: {
        ...messageData.rawMessage,
        html: (replaceInHtml && messageData.rawMessage.html.replace(htmlExpression, '')) || messageData.rawMessage.html,
      },
    };
  };

  describe('when an incoming email is evaluated by the email parser', () => {
    [
      { rawData: apartments, provider: 'apartments.com', result: true },
      {
        rawData: apartmentSearch,
        provider: 'apartmentsearch.com',
        result: true,
      },
      { rawData: contactUs, provider: 'contactus', result: true },
      {
        rawData: contactUsWithoutQualificationQuestions,
        provider: 'contactus',
        result: true,
      },
      { rawData: forRent, provider: 'forrent.com', result: true },
      { rawData: yelp, provider: 'yelp', result: true },
      { rawData: respage, provider: 'respage', result: true },
      { rawData: zendesk, provider: 'zendesk.com', result: true },
      { rawData: zillow, provider: 'zillow', result: true },
      { rawData: zillowReplyToAsObject, provider: 'zillow', result: true },
      { rawData: zumper, provider: 'zumper.com', result: true },
      {
        rawData: { from: 'vvsct1@yahoo.com' },
        provider: 'yahoo.com',
        result: false,
      },
      {
        rawData: { from: 'bill@gmail.com' },
        provider: 'gmail.com',
        result: false,
      },
    ].forEach(({ rawData, provider, result }) => {
      const text = result ? '' : 'not ';
      it(`should ${text}be processed when the sender ends with '${provider}'`, () => {
        const messageData = getMessageDataForProvider(rawData);
        const emailParserProvider = getEmailParserProvider(messageData);
        expect(!!emailParserProvider).to.equal(result);
      });
    });
  });

  const emailParserData = [
    {
      providerName: 'apartments.com',
      leadName: 'Echo Berkeley',
      leadEmail: 'echo.berkeley99@gmail.com',
      leadPhoneInformation: '(510) 944-4224',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(apartments, includeEmail, {
          emailExpression: 'Email: echo.berkeley99@gmail.com',
        }),
    },
    {
      providerName: 'apartmentsearch.com',
      leadName: 'Fedelmid Durga',
      leadEmail: 'fedelmiddurga@gmail.com',
      leadPhoneInformation: '6506918351',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(apartmentSearch, includeEmail, {
          emailExpression: 'Email: fedelmiddurga@gmail.com',
        }),
    },
    {
      providerName: 'contactus',
      leadName: 'Patrick Gonzales',
      leadEmail: 'patrick.gonzales@gmail.com',
      leadPhoneInformation: '(510) 862-3038',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(contactUs, includeEmail, {
          emailExpression: 'email:patrick.gonzales@gmail.com',
        }),
    },
    {
      providerName: 'contactus',
      leadName: 'Lois Lane',
      leadEmail: 'lois.reports@gmail.com',
      leadPhoneInformation: '(510) 944-4422',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(contactUsWithoutQualificationQuestions, includeEmail, { emailExpression: 'email:lois.reports@gmail.com' }),
    },
    {
      providerName: 'forrent.com',
      leadName: 'Mikayla Lazaro',
      leadEmail: 'mikaylalazaro@gmail.com',
      leadPhoneInformation: '(408) 797-8007',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(forRent, includeEmail, { emailExpression: 'mailto:mikaylalazaro@gmail.com', replaceInHtml: true }),
    },
    {
      providerName: 'yelp',
      leadName: 'Jessamine Tunnelly',
      leadEmail: 'reply+f67322335aee40bdbf9528e2ebe825fd@messaging.yelp.com',
      leadPhoneInformation: '',
      useAnonymizedEmail: true,
      getMessageData: (includeEmail = true) => getMessageDataForProvider(yelp, includeEmail),
    },
    {
      providerName: 'respage',
      leadName: 'Noel',
      leadEmail: 'noelh@respage.com',
      leadPhoneInformation: '', // restpage does not have phone information in the email body
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(respage, includeEmail, {
          emailExpression: 'Email: noelh@respage.com',
        }),
    },
    {
      providerName: 'zendesk.com',
      leadName: 'William Roche',
      leadEmail: 'william.roche@fema.dhs.gov',
      leadPhoneInformation: '202-578-6165',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(zendesk, includeEmail, {
          emailExpression: 'Email Address: william.roche@fema.dhs.gov',
        }),
    },
    {
      providerName: 'zillow',
      leadName: 'Fedelmid Durga',
      leadEmail: 'fedelmiddurga@gmail.com',
      leadPhoneInformation: '650.691.8351',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(zillow, includeEmail, {
          emailExpression: 'fedelmiddurga@gmail.com',
          emailInHeaders: true,
        }),
    },
    {
      providerName: 'zillow',
      leadName: 'Christophe Reva',
      leadEmail: 'christophe_gillette@yahoo.com',
      leadPhoneInformation: '650.468.0820',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(zillowReplyToAsObject, includeEmail, {
          emailInHeaders: true,
        }),
    },
    {
      providerName: 'zillow',
      leadName: 'griffin bouchard',
      leadEmail: 'griffinbouchard@gmail.com',
      leadPhoneInformation: '202.677.1177',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(zillow3, includeEmail, {
          emailInHeaders: false,
          emailExpression: 'griffinbouchard@gmail.com',
        }),
    },
    {
      providerName: 'zillow',
      leadName: 'Linda Johnson',
      leadEmail: 'lsj9148@gmail.com',
      leadPhoneInformation: '970.924.0423',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(zillow2, includeEmail, {
          emailExpression: 'lsj9148@gmail.com',
        }),
    },
    {
      providerName: 'zumper.com',
      leadName: 'Marigold Zaragamba',
      leadEmail: 'ganesh+qatest+zumperx@reva.tech',
      leadPhoneInformation: '(650) 991-8151',
      getMessageData: (includeEmail = true) =>
        getMessageDataForProvider(zumper, includeEmail, {
          emailInHeaders: true,
          replyTo: { value: [{ name: 'Marigold Zaragamba' }] },
        }),
    },
  ];

  emailParserData.forEach(communication => {
    const { providerName, getMessageData, ...emailData } = communication;
    describe(`Chat email coming from ${providerName}`, () => {
      describe('when the inbound email has email address on the body', () => {
        it('should extract the name and email', async () => {
          const messageData = getMessageData();
          const provider = getEmailParserProvider(messageData);
          const { from, fromName } = provider.parseEmailInformation(messageData);
          expect(provider.providerName).to.equal(providerName);
          expect(emailData.leadEmail).to.equal(from);
          expect(emailData.leadName).to.equal(fromName);
        });
      });

      describe('when the inbound email has not email address on the body', () => {
        it('should extract the information with an empty value as email', async () => {
          const messageData = getMessageData(false);
          const { from, fromName, contactInfo, provider } = await getParsedInformation(messageData);
          const senderPhone = formatPhoneNumberForDb(emailData.leadPhoneInformation);
          const senderEmail = emailData.useAnonymizedEmail ? emailData.leadEmail : null;
          expect(provider.providerName).to.equal(providerName);
          expect(from).to.equal(senderEmail);
          expect(emailData.leadName).to.equal(fromName);
          expect(senderPhone).to.equal(contactInfo.phone);
        });
      });
    });
  });

  describe('when the inbound email has qualification questions on the body', () => {
    [
      {
        ...emailParserData[2],
        additionalFields: {
          qualificationQuestions: {
            numBedrooms: ['TWO_BEDS'],
            moveInTime: 'NEXT_2_MONTHS',
            groupProfile: 'CORPORATE',
          },
        },
      },
      {
        ...emailParserData[3],
        additionalFields: {
          qualificationQuestions: undefined,
        },
      },
    ].forEach(communication => {
      const { providerName, getMessageData, ...emailData } = communication;
      it(`should extract the valid qualification questions from ${providerName} email`, () => {
        const messageData = getMessageData();
        const provider = getEmailParserProvider(messageData);
        const { additionalFields } = provider.parseEmailInformation(messageData);
        expect(provider.providerName).to.equal(providerName);
        expect(emailData.additionalFields.qualificationQuestions).to.eql(additionalFields.qualificationQuestions);
      });
    });
  });
});
