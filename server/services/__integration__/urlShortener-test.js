/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sendUrltoShortener } from '../urlShortener';
import '../../testUtils/setupTestGlobalContext';
import config from '../../config';
import { IS_URL } from '../../../common/regex';
import { createJWTToken } from '../../../common/server/jwt-helpers';

const { urlShortener } = config;
chai.use(chaiAsPromised);
const { expect } = chai;

describe('call url shortener', () => {
  const tokenFirstPerson = createJWTToken({
    quoteId: 'wer-2542-fsf',
    personId: 'okfs-sdfsf-dfsf',
    personName: 'John',
  });

  const tokenSecondPerson = createJWTToken({
    quoteId: 'wer-2542-fsf',
    personId: 'okfs-sdfsf-dfsf',
    personName: 'Maria',
  });

  const urlsInfo = [`http://amazon.com?token=${tokenFirstPerson}`, `https://techcrunch.com?token=${tokenSecondPerson}`];

  const invalidUrlsInfo = ['', 'amazon.'];

  describe('given an array with quoteIds, personIds, personNames and urls', () => {
    it('should return an array of shortened urls', async () => {
      const results = await sendUrltoShortener({}, urlsInfo);
      expect(results).to.be.a('array');
      expect(results).to.have.lengthOf(2);
      results.forEach(result => {
        expect(result).to.match(IS_URL);
        expect(result).to.contain(urlShortener.cdn_prefix);
      });
    });
  });

  describe('given an array with invalid urls', () => {
    it('should return an error', () => {
      const shortenerPromise = sendUrltoShortener({}, invalidUrlsInfo);
      return expect(shortenerPromise).to.be.rejected;
    });
  });
});
