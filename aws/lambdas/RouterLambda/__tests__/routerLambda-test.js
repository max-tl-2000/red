/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getEnvSpecificData } from '../index';

describe('Retrieve correct env data for router Lambda ', () => {
  describe('given a valid dev account email', () => {
    const developerEnvHostname = '10.226.200.22';
    const toMail = 'bayarea@red.local.env.mail.reva.tech';
    const fromMail = 'darius@reva.tech';
    const data = getEnvSpecificData(toMail, fromMail);

    it('should return local email bucket', () => {
      expect(data.bucket).to.contain('local');
    });

    it(`should return local dev machine hostname ${developerEnvHostname}`, () => {
      expect(data.hostname).to.equal(developerEnvHostname);
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a valid cucumber test account email', () => {
    const cucumberEnvHostname = 'cucumber-5';
    const toMail = 'bayarea@cucumber.local.env.mail.reva.tech';
    const fromMail = `${cucumberEnvHostname}@reva.tech`;
    const data = getEnvSpecificData(toMail, fromMail);

    it('should return local email bucket', () => {
      expect(data.bucket).to.contain('local');
    });

    it(`should return cucumber test machine hostname ${cucumberEnvHostname}`, () => {
      expect(data.hostname).to.equal(cucumberEnvHostname);
    });

    it('should return cucumber tenant', () => {
      expect(data.tenant).to.equal('cucumber');
    });
  });

  describe('given a valid prod account email', () => {
    const toMail = 'bayarea@red.mail.reva.tech';
    const fromMail = 'darius@reva.tech';
    const data = getEnvSpecificData(toMail, fromMail);

    it('should return prod email bucket', () => {
      expect(data.bucket).to.not.contain('dev');
    });

    it('should return production hostname', () => {
      expect(data.hostname).to.equal('red.reva.tech');
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a valid demo account email', () => {
    const toMail = 'bayarea@red.demo.env.mail.reva.tech';
    const fromMail = 'darius@reva.tech';
    const data = getEnvSpecificData(toMail, fromMail);

    it('should return demo email bucket', () => {
      expect(data.bucket).to.contain('demo');
    });

    it('should return demo hostname', () => {
      expect(data.hostname).to.equal('red.demo.env.reva.tech');
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });

  describe('given a valid demo staging account email', () => {
    const toMail = 'bayarea@red.demo-staging.env.mail.reva.tech';
    const fromMail = 'darius@reva.tech';
    const data = getEnvSpecificData(toMail, fromMail);

    it('should return staging demo email bucket', () => {
      expect(data.bucket).to.contain('staging');
    });

    it('should return staging demo hostname', () => {
      expect(data.hostname).to.equal('red.demo-staging.env.reva.tech');
    });

    it('should return red tenant', () => {
      expect(data.tenant).to.equal('red');
    });
  });
});
