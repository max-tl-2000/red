/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getEnvSpecificData } from '../index';

describe('Retrieve correct domain data for SendGrid message', () => {
  describe('given a local message', () => {
    const message = {
      revaDomain: 'local.env.reva.tech',
      tenantName: 'red',
      cloudEnv: 'mircea',
    };

    const data = getEnvSpecificData(message);

    it('should return the correct data', () => {
      expect(data.hostname).to.equal('10.226.200.110');
      expect(data.tenantName).to.equal('red');
      expect(data.domain).to.equal('local.env.reva.tech');
    });
  });

  describe('given a prod message', () => {
    const message = {
      revaDomain: 'reva.tech',
      tenantName: 'customerold',
      cloudEnv: 'prod',
    };

    const data = getEnvSpecificData(message);

    it('should return the correct data', () => {
      expect(data.hostname).to.equal('customerold.reva.tech');
      expect(data.tenantName).to.equal('customerold');
      expect(data.domain).to.equal('reva.tech');
    });
  });

  describe('given a staging message', () => {
    const message = {
      revaDomain: 'staging-blue.env.reva.tech',
      tenantName: 'adi2',
      cloudEnv: 'staging-blue',
    };

    const data = getEnvSpecificData(message);

    it('should return the correct data', () => {
      expect(data.hostname).to.equal('adi2.staging-blue.env.reva.tech');
      expect(data.tenantName).to.equal('adi2');
      expect(data.domain).to.equal('staging-blue.env.reva.tech');
    });
  });

  describe('given a message with an empty cloudEnv', () => {
    const message = {
      revaDomain: 'test1.env.reva.tech',
      tenantName: 'adi2',
      cloudEnv: '',
    };

    const data = getEnvSpecificData(message);

    it('should return the correct data', () => {
      expect(data.hostname).to.equal('adi2.test1.env.reva.tech');
      expect(data.tenantName).to.equal('adi2');
      expect(data.domain).to.equal('test1.env.reva.tech');
    });
  });
});
