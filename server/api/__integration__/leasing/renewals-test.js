/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../api';
import { createAParty, createAUser } from '../../../testUtils/repoHelper';
import { partyKeys } from '../../../testUtils/expectedKeys';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { createActiveLeaseParty } from '../../../testUtils/partyWorkflowTestHelper';
import { now } from '../../../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../../../common/date-constants';

describe('/renewals', () => {
  describe('when the partyId is invalid/missing', () => {
    it('responds with the expected status code and token', async () => {
      // when the payload does not contain a partyId - 400 / INCORRECT_PARTY_ID
      const {
        status: status1,
        body: { token: token1 },
      } = await request(app).post('/renewals').set(getAuthHeader(tenant.id)).send();
      expect(status1).to.equal(400);
      expect(token1).to.equal('INCORRECT_PARTY_ID');

      // when the payload contains an invalid partyId - 400 / INCORRECT_PARTY_ID
      const {
        status: status2,
        body: { token: token2 },
      } = await request(app).post('/renewals').set(getAuthHeader(tenant.id)).send({ partyId: 'invalid_party_id' });
      expect(status2).to.equal(400);
      expect(token2).to.equal('INCORRECT_PARTY_ID');

      // when the party id from payload does not exist - 404 / PARTY_NOT_FOUND
      const {
        status: status3,
        body: { token: token3 },
      } = await request(app).post('/renewals').set(getAuthHeader(tenant.id)).send({ partyId: newId() });
      expect(status3).to.equal(404);
      expect(token3).to.equal('PARTY_NOT_FOUND');
    });
  });

  describe('when the party is not eligible for renewal', () => {
    it('responds with status code 412 and PARTY_NOT_ELIGIBLE_FOR_RENEWAL token', async () => {
      const { id: partyId } = await createAParty({
        workflowState: DALTypes.WorkflowState.ACTIVE,
        workflowName: DALTypes.WorkflowName.NEW_LEASE,
      });
      const {
        status,
        body: { token },
      } = await request(app).post('/renewals').set(getAuthHeader(tenant.id)).send({ partyId });
      expect(status).to.equal(412);
      expect(token).to.equal('PARTY_NOT_ELIGIBLE_FOR_RENEWAL');
    });
  });

  describe('when the payload contains an eligible partyId', () => {
    it('responds with status 200 and with the created renewal party', async () => {
      const { activeLeaseParty: party } = await createActiveLeaseParty({
        leaseEndDate: now().add(1, 'year').format(DATE_US_FORMAT),
      });

      const { status, body } = await request(app).post('/renewals').set(getAuthHeader(tenant.id)).send({ partyId: party.id });

      expect(status).to.equal(200);
      expect(body).to.have.all.keys(partyKeys);
      expect(body.seedPartyId).to.equal(party.id);
      expect(body.workflowName).to.equal(DALTypes.WorkflowName.RENEWAL);
      expect(body.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
    });
  });

  describe('when the logged agent is a reva admin then', () => {
    it('the resulting renewal party will be owned by the dispatcher agent', async () => {
      const { activeLeaseParty: party, users } = await createActiveLeaseParty({
        leaseEndDate: now().add(1, 'year').format(DATE_US_FORMAT),
      });

      const { dispatcherUserId, adminUserId } = users;
      const { status, body } = await request(app).post('/renewals').set(getAuthHeader(tenant.id, adminUserId)).send({ partyId: party.id });

      expect(status).to.equal(200);
      expect(body.userId).to.equal(dispatcherUserId);
    });
  });

  describe('when the logged agent is in at least in one of the teams covering the property then', () => {
    it('the resulting renewal party will be owned by the logged agent', async () => {
      const { activeLeaseParty: party, users } = await createActiveLeaseParty({
        leaseEndDate: now().add(1, 'year').format(DATE_US_FORMAT),
      });

      const { leasingAgentUserId } = users;
      const { status, body } = await request(app).post('/renewals').set(getAuthHeader(tenant.id, leasingAgentUserId)).send({ partyId: party.id });

      expect(status).to.equal(200);
      expect(body.userId).to.equal(leasingAgentUserId);
    });
  });

  describe('when the logged in agent is in none of the teams covering the property then', () => {
    it('the resulting renewal party will be owned by the dispatcher agent', async () => {
      const { activeLeaseParty: party, users } = await createActiveLeaseParty({
        leaseEndDate: now().add(1, 'year').format(DATE_US_FORMAT),
      });

      const { id: userId } = await createAUser();
      const { dispatcherUserId } = users;

      const { status, body } = await request(app).post('/renewals').set(getAuthHeader(tenant.id, userId)).send({ partyId: party.id });

      expect(status).to.equal(200);
      expect(body.userId).to.equal(dispatcherUserId);
    });
  });
});
