/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';

import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { testCtx as ctx, createAParty } from '../../../testUtils/repoHelper';
import { knex } from '../../../database/factory';
import '../../../testUtils/setupTestGlobalContext';

describe('Units Filters', () => {
  let party;

  beforeEach(async () => {
    party = await createAParty();
  });

  context('PUT "api/parties/:partyId/units-filters"', () => {
    const data = {
      propertyIds: [],
      numBedrooms: [],
      marketRent: { min: null, max: null },
      amenities: [],
    };

    it('should return 404 if the party does not exist', async () => {
      const id = '11111111-2222-3333-4444-555555555555';

      await request(app).put(`/parties/${id}/units-filters`).send(data).set(getAuthHeader()).expect(404);
    });

    // 204 would be a better status code
    it('should save the given filters and return a 20x status and an empty body', async () => {
      await request(app)
        .put(`/parties/${party.id}/units-filters`)
        .set(getAuthHeader())
        .send(data)
        .expect(200)
        .expect(response => { // eslint-disable-line
          expect(response.body).to.be.empty;

          // knex is used with `.then` so no `await` is required
          knex
            .withSchema(ctx.tenantId)
            .from('Party')
            .select('storedUnitsFilters')
            .where({ id: party.id })
            .first()
            .then(party_ => {
              expect(party_.storedUnitsFilters).to.deep.equal(data);
            });
        });
    });

    xit('should fail if the given filters are wrong and return a 400 status', async () => {
      const filters = { ...data };
      delete filters['numBedrooms'];  // eslint-disable-line
      filters.somethinWrong = 'this will not be saved';

      await request(app).put(`/units/filters/${party.id}`).set(getAuthHeader()).send(filters).expect(400);
    });
  });
});
