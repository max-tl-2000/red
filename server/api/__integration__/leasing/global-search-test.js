/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import { tenant } from '../../../testUtils/setupTestGlobalContext';

import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { createALeasingUser } from '../../../testUtils/repoHelper';

describe('API/search-history', () => {
  describe('when the user has no search history', () => {
    it('should return an empty array as history searches', async () => {
      const user = await createALeasingUser();
      await request(app)
        .get(`/users/${user.id}/search-history`)
        .set(getAuthHeader(tenant.id, user.id))
        .expect(200)
        .expect(res => expect(res.body.searches).to.deep.equal([]));
    });
  });

  describe('when the user has search history', () => {
    it('should return an array of searches', async () => {
      const results = [{ value: 'foo' }, { value: 'bar' }];
      const user = await createALeasingUser({
        metadata: { searchHistory: results },
      });

      await request(app)
        .get(`/users/${user.id}/search-history`)
        .set(getAuthHeader(tenant.id, user.id))
        .expect(200)
        .expect(res => expect(res.body.searches).to.deep.equal(results));
    });

    it('it should never have more than 10', async () => {
      const results = [];

      for (let i = 0; i < 20; i++) {
        results.push({ value: `foo_${i}` });
      }

      const user = await createALeasingUser({
        metadata: { searchHistory: results },
      });

      await request(app)
        .get(`/users/${user.id}/search-history`)
        .set(getAuthHeader(tenant.id, user.id))
        .expect(200)
        .expect(res => expect(res.body.searches).to.deep.equal(results.slice(0, 10)));
    });

    it('it should move to the beginning the most recent search', async () => {
      // values at the end are older
      const results = [{ value: 'foo' }, { value: 'baz' }, { value: 'foobar' }];
      const user = await createALeasingUser({
        metadata: { searchHistory: results },
      });

      await request(app)
        .put(`/users/${user.id}/search-history`)
        .set(getAuthHeader(tenant.id, user.id))
        .send({ searches: [{ value: 'foobar' }] })
        .expect(200)
        .expect(res => expect(res.body.searches).to.deep.equal([{ value: 'foobar' }, { value: 'foo' }, { value: 'baz' }]));
    });
  });
});
