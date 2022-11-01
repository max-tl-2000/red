/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getMailDomain, isMessageToNoreply, isSESMailerDaemon } from '../index';

describe('Retrieve correct mail subdomain data for SES spam filter', () => {
  describe('given a valid email account', () => {
    const email = 'user@red.mail.reva.tech';
    const subdomain = getMailDomain(email);
    console.log(subdomain);
    it('should return correct production mail subdomain', () => {
      expect(subdomain).to.equal('red.mail.reva.tech');
    });
  });
});

describe('Check for noreply email address for SES spam filter', () => {
  describe('given a noreply email address', () => {
    const mailAddress = 'noreply@red.demo-staging.mail.reva.tech';
    it('should return true', () => {
      expect(isMessageToNoreply(mailAddress)).to.equal(true);
    });
  });

  describe('given a no-reply email address', () => {
    const mailAddress = 'no-reply@red.demo-staging.mail.reva.tech';
    it('should return true', () => {
      expect(isMessageToNoreply(mailAddress)).to.equal(true);
    });
  });

  describe('given a valid email address', () => {
    const mailAddress = 'joan@red.demo-staging.mail.reva.tech';
    it('should return false', () => {
      expect(isMessageToNoreply(mailAddress)).to.equal(false);
    });
  });

  describe('given multiple recipients and a noreply email address', () => {
    const recipient = 'noreply@red.demo-staging.mail.reva.tech';
    it('should return true', () => {
      expect(isMessageToNoreply(recipient)).to.equal(true);
    });
  });
});

describe('Check for failed email delivery SES spam filter', () => {
  describe('given mailer-daemon email address', () => {
    const mailAddress = 'MAILER-DAEMON@amazonses.com';
    it('should return true', () => {
      expect(isSESMailerDaemon(mailAddress)).to.equal(true);
    });
  });

  describe('given a valid email address', () => {
    const mailAddress = 'joan@red.demo-staging.mail.reva.tech';
    it('should return false', () => {
      expect(isSESMailerDaemon(mailAddress)).to.equal(false);
    });
  });
});
