/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from '../../test-helpers';
import { parseEmailMessage } from '../emailParser';

describe('parse a thread of emails', () => {
  const firstEmail = {
    message: {
      text: 'Hi Florin,\nI have a few questions. I will send you an email later today.\nBye.\n',
    },
    messageId: '0100015a475c4719-d89c8725-e2bc-456b-9e8b-83c227ffa49e-000000',
  };

  const replyToFirstEmail = {
    message: {
      text:
        'Hi Bill,\nWaiting to get your questions.\nRegards\n\nOn Thu, Feb 16, 2017 at 4:38 PM, Bill Smith <\nbay_leasing@green.local.envmail.reva.tech> wrote:\n\n> Hi Florin,\n> I have a few questions. I will send you an email later today.\n> Bye.\n>\n',
      messageId: 'CAC0s5uLoDj5Xm++ex4L_cJ_LqAFQ55iCLYGzyprGF5NQMuHZWg',
      rawMessage: {
        text:
          'Hi Bill,\nWaiting to get your questions.\nRegards\n\nOn Thu, Feb 16, 2017 at 4:38 PM, Bill Smith <\nbay_leasing@green.local.envmail.reva.tech> wrote:\n\n> Hi Florin,\n> I have a few questions. I will send you an email later today.\n> Bye.\n>\n',
        inReplyTo: '<0100015a475c4719-d89c8725-e2bc-456b-9e8b-83c227ffa49e-000000@email.amazonses.com>',
        messageId: 'CAC0s5uLoDj5Xm++ex4L_cJ_LqAFQ55iCLYGzyprGF5NQMuHZWg@mail.gmail',
      },
    },
  };

  const automaticReplyEmail = {
    message: {
      text: undefined,
      messageId: 'CAC0s5uLoDj5Xm++ex4L_cJ_LqAFQ55iCLYGzyprGF5NQMuHZWg',
      rawMessage: {
        text: undefined,
        inReplyTo: '<0100015a475c4719-d89c8725-e2bc-456b-9e8b-83c227ffa49e-000000@email.amazonses.com>',
        messageId: 'CAC0s5uLoDj5Xm++ex4L_cJ_LqAFQ55iCLYGzyprGF5NQMuHZWg@mail.gmail',
      },
    },
  };

  const secondEmail = {
    message: {
      text: 'Question 1 ...\nQuestion 2 ...\nQuestion 3 ...\n',
      inReplyTo: 'CAC0s5uLoDj5Xm++ex4L_cJ_LqAFQ55iCLYGzyprGF5NQMuHZWg',
    },
    messageId: '0100015a4782639b-7cb4dc52-710e-471e-a15a-eddfac264991-000000',
  };

  const replyToSecondEmail = {
    message: {
      text:
        'My answers bellow:\n\nOn Thu, Feb 16, 2017 at 5:20 PM, Bill Smith <\nbay_leasing@green.local.envmail.reva.tech> wrote:\n\n> Question 1 ...\n>\n- Answer 1\n\n> Question 2 ...\n>\n- Answer 2\n\n> Question 3 ...\n>\n',
      messageId: 'CAC0s5uJMQDmjzhau4w27f1VigSyj96FY2OTv5LDLJNDOiy0C2Q',
      rawMessage: {
        text:
          'My answers bellow:\n\nOn Thu, Feb 16, 2017 at 5:20 PM, Bill Smith <\nbay_leasing@green.local.envmail.reva.tech> wrote:\n\n> Question 1 ...\n>\n- Answer 1\n\n> Question 2 ...\n>\n- Answer 2\n\n> Question 3 ...\n>\n',
        inReplyTo: '<0100015a4782639b-7cb4dc52-710e-471e-a15a-eddfac264991-000000@email.amazonses.com>',
        messageId: 'CAC0s5uJMQDmjzhau4w27f1VigSyj96FY2OTv5LDLJNDOiy0C2Q@mail.gmail.com',
      },
    },
  };

  const emailThread = [firstEmail, replyToFirstEmail, secondEmail, replyToSecondEmail];

  describe('When the email has no inReplyTo', () => {
    it('should return the email text', () => {
      const result = parseEmailMessage(firstEmail, emailThread);
      expect(result).to.equal(firstEmail.message.text);
    });
  });
  describe('When the email is a reply and the original inReplyTo text was not altered', () => {
    it('should return only the text from reply email', () => {
      const result = parseEmailMessage(replyToFirstEmail, emailThread);
      expect(result).to.equal('Hi Bill,\nWaiting to get your questions.\nRegards\n\n');
    });
  });
  describe('When the email is a reply and the original inReplyTo text was altered', () => {
    it('should return the text from reply email and inReplyTo altered text', () => {
      const result = parseEmailMessage(replyToSecondEmail, emailThread);
      expect(result).to.equal(replyToSecondEmail.message.text);
    });
  });

  describe('When the email is an automatic reply', () => {
    it('should return the text from reply email', () => {
      const result = parseEmailMessage(automaticReplyEmail, [firstEmail, automaticReplyEmail]);
      expect(result).to.equal('');
    });
  });
});
