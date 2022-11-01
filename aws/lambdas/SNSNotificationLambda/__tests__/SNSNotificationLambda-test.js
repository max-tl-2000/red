/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getEnvSpecificData } from '../index';

describe('Retrieve correct domain data for SNS notification', () => {
  describe('given a valid prod account email', () => {
    const fromMail = 'bayarea@red.mail.reva.tech';
    const toMail = 'darius@example.com';
    const data = getEnvSpecificData(fromMail, toMail);

    it('should return production hostname', () => {
      expect(data.hostname).to.equal('red.reva.tech');
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a valid dev account email', () => {
    const developerEnvHostname = '10.226.200.22';
    const fromMail = 'bayarea@red.local.env.mail.reva.tech';
    const toMail = 'darius@reva.tech';
    const data = getEnvSpecificData(fromMail, toMail);

    it(`should return local dev machine hostname ${developerEnvHostname}`, () => {
      expect(data.hostname).to.contain(developerEnvHostname);
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a valid cucumber test account email', () => {
    const cucumberEnvHostname = 'cucumber-5';
    const fromMail = 'bayarea@red.local.env.mail.reva.tech';
    const toMail = `${cucumberEnvHostname}@reva.tech`;
    const data = getEnvSpecificData(fromMail, toMail);

    it(`should return cucumber test machine hostname ${cucumberEnvHostname}`, () => {
      expect(data.hostname).to.contain(cucumberEnvHostname);
    });

    it('should return cucumber tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a valid non local cucumber test account email', () => {
    const cucumberEnvHostname = 'cucumber-5';
    const fromMail = `bayarea@cucumber.${cucumberEnvHostname}.env.mail.reva.tech`;
    const toMail = 'qatest_johndoe_123@reva.tech';
    const data = getEnvSpecificData(fromMail, toMail);

    it(`should return cucumber test machine hostname ${cucumberEnvHostname}`, () => {
      expect(data.hostname).to.contain(cucumberEnvHostname);
    });

    it('should return cucumber tenant', () => {
      expect(data.tenant).to.equal('cucumber');
    });
  });

  describe('given a valid demo account email', () => {
    const fromMail = 'bayarea@red.demo.env.mail.reva.tech';
    const toMail = 'darius@reva.tech';
    const data = getEnvSpecificData(fromMail, toMail);

    it('should return demo hostname', () => {
      expect(data.hostname).to.equal('red.demo.env.reva.tech');
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a valid staging demo account email', () => {
    const fromMail = 'bayarea@red.demo-staging.env.mail.reva.tech';
    const toMail = 'darius@reva.tech';
    const data = getEnvSpecificData(fromMail, toMail);

    it('should return staging demo hostname', () => {
      expect(data.hostname).to.equal('red.demo-staging.env.reva.tech');
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a noreply email', () => {
    const fromMail = 'noreply@@red.demo-staging.env.mail.reva.tech';
    const toMail = 'darius@reva.tech';
    const data = getEnvSpecificData(fromMail, toMail);

    it('should return the recipient as noreply', () => {
      expect(data.recipient).to.equal('noreply');
    });
  });
});
