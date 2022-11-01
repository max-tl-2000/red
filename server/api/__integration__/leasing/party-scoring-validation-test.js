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
import { createAParty } from '../../../testUtils/repoHelper';
import { getPartyDocumentByPartyId } from '../../../dal/partyDocumentRepo';
import { tenant, enableAggregationTriggers } from '../../../testUtils/setupTestGlobalContext';

describe('API/partyScoring', () => {
  let party;
  let header;
  beforeEach(async () => {
    await enableAggregationTriggers(tenant.id);
    party = await createAParty();
    const { id } = await getPartyDocumentByPartyId({ tenantId: tenant.id }, party.id);
    header = getAuthHeader(tenant.id, party.userId, null, false, { partyId: party.id, documentVersion: id });
  });

  describe('updating party scoring', () => {
    const updatePartyScoringRequest = body => request(app).post(`/public/party/${party.id}/score`).set(header).send(body);

    describe('with invalid body', () => {
      it('has validation error in response', async () => {
        const body = {
          partyId: party.id,
          scoring: 'violet',
        };
        const res = await updatePartyScoringRequest(body).expect(400);

        expect(res.body).to.have.all.keys(['jsonSchemaValidation', 'statusText', 'validations']);
        expect(res.body.statusText).to.equal('Bad Request');
        expect(res.body.jsonSchemaValidation).to.equal(true);
        expect(res.body.validations).to.deep.equal({
          body: [
            {
              messages: ['is required'],
              property: 'request.body.score',
            },
          ],
        });
      });
    });

    describe('with invalid score', () => {
      it('has validation error in response', async () => {
        const body = {
          partyId: party.id,
          score: 'violet',
        };
        const res = await updatePartyScoringRequest(body).expect(400);

        expect(res.body).to.have.all.keys(['jsonSchemaValidation', 'statusText', 'validations']);
        expect(res.body.statusText).to.equal('Bad Request');
        expect(res.body.jsonSchemaValidation).to.equal(true);
        expect(res.body.validations).to.deep.equal({
          body: [
            {
              messages: ['is not one of enum values: prospect,bronze,silver,gold'],
              property: 'request.body.score',
              value: 'violet',
            },
          ],
        });
      });
    });
  });
});
