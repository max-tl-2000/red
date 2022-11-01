/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader, setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { getPartyBy } from '../../../dal/partyRepo';
import { testCtx as ctx, createAUser, createAParty, createAProperty, createAnAdminUser, createATask } from '../../../testUtils/repoHelper';
import { getTasksByPartyIds } from '../../../dal/tasksRepo';
import { DATE_US_FORMAT } from '../../../../common/date-constants';
import { createNewLeaseParty, setupMsgQueueAndWaitFor } from '../../../testUtils/partyWorkflowTestHelper';
import { updateProperty } from '../../../dal/propertyRepo';
import { updateAssignedProperty } from '../../../services/party';
import { getLeaseById } from '../../../dal/leaseRepo';
import { getInventoryById } from '../../../dal/inventoryRepo';

describe('API/party', () => {
  describe('given a request to archive parties from sold properties', () => {
    describe('when the user is not the admin', () => {
      it('returns 403 and FORBIDDEN token', async () => {
        const user = await createAUser();

        await request(app)
          .post(`/tenants/${ctx.id}/archivePartiesFromSoldProperties`)
          .set(getAuthHeader(ctx.id, user.id, false, false, user))
          .expect(403)
          .expect(res => expect(res.body.token).to.equal('FORBIDDEN'));
      });
    });

    describe('when the tenant id not valid', () => {
      it('returns 400 and INVALID_TENANT_ID token', async () => {
        const user = await createAnAdminUser({ tenantId: ctx.id });

        await request(app)
          .post('/tenants/test/archivePartiesFromSoldProperties')
          .set(getAuthHeader(ctx.id, user.id, false, false, user))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_TENANT_ID'));
      });
    });

    describe('when the property ids are missing from the request', () => {
      it('returns 400 and MISSING_PROPERTY_IDS token', async () => {
        const user = await createAnAdminUser({ tenantId: ctx.id });

        await request(app)
          .post(`/tenants/${ctx.id}/archivePartiesFromSoldProperties`)
          .set(getAuthHeader(ctx.id, user.id, false, false, user))
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('MISSING_PROPERTY_IDS'));
      });
    });

    describe('when there are no sold properties', () => {
      it('should not archive any party', async () => {
        const user = await createAnAdminUser({ tenantId: ctx.id });

        const property = await createAProperty();
        const party = await createAParty({
          assignedPropertyId: property.id,
        });

        const { task } = await setupQueueToWaitFor([], ['party']);

        await request(app)
          .post(`/tenants/${ctx.id}/archivePartiesFromSoldProperties`)
          .set(getAuthHeader(ctx.id, user.id, false, false, user))
          .send({ propertyIds: [property.id] })
          .expect(200);

        await task;

        const updatedParty = await getPartyBy(ctx, { id: party.id });
        expect(updatedParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
      });
    });

    describe('when there is a sold property', () => {
      beforeEach(async () => await setupMsgQueueAndWaitFor([], ['lease']));

      it('should archive only the active parties from the sold property and cancel all the tasks', async () => {
        const user = await createAnAdminUser({ tenantId: ctx.id });

        const property = await createAProperty({}, { endDate: now().toISOString() });
        const party = await createAParty({
          assignedPropertyId: property.id,
        });

        const party2 = await createAParty({
          assignedPropertyId: property.id,
          workflowState: DALTypes.WorkflowState.ARCHIVED,
        });

        const party3 = await createAParty();

        await createATask({ partyId: party.id, userIds: [user.id] });
        const { task } = await setupQueueToWaitFor([], ['party']);

        await request(app)
          .post(`/tenants/${ctx.id}/archivePartiesFromSoldProperties`)
          .set(getAuthHeader(ctx.id, user.id, false, false, user))
          .send({ propertyIds: [property.id] })
          .expect(200);

        await task;

        const [t] = await getTasksByPartyIds(ctx, [party.id]);
        expect(t.state).to.equal(DALTypes.TaskStates.CANCELED);

        const updatedParty = await getPartyBy(ctx, { id: party.id });
        expect(updatedParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);

        const updatedParty2 = await getPartyBy(ctx, { id: party2.id });
        expect(updatedParty2.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);

        const updatedParty3 = await getPartyBy(ctx, { id: party3.id });
        expect(updatedParty3.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
      });

      it('should update the property and archive the parties with an active lease on a unit from the sold property but a different assigned property', async () => {
        const user = await createAnAdminUser({ tenantId: ctx.id });
        const newLeaseStartDate = now().add(10, 'days').toISOString();
        const leaseEndDate = now().add(100, 'days').format(DATE_US_FORMAT);

        const { party, leaseId, property } = await createNewLeaseParty({
          leaseStartDate: newLeaseStartDate,
          leaseEndDate,
          shouldSignLease: false,
        });
        expect(party).to.be.ok;

        const lease = await getLeaseById(ctx, leaseId);
        const inventory = await getInventoryById(ctx, { id: lease.baselineData.quote.inventoryId });

        const property2 = await createAProperty();
        await updateAssignedProperty(ctx, party.id, property2.id);

        const partyWithUpdatedProperty = await getPartyBy(ctx, { id: party.id });

        expect(partyWithUpdatedProperty.assignedPropertyId).to.equal(property2.id);
        expect(partyWithUpdatedProperty.assignedPropertyId).to.not.equal(inventory.propertyId);

        await updateProperty(ctx, { id: property.id }, { endDate: now().toISOString() });

        await createATask({ partyId: party.id, userIds: [user.id] });
        const { task } = await setupQueueToWaitFor([], ['party']);

        await request(app)
          .post(`/tenants/${ctx.id}/archivePartiesFromSoldProperties`)
          .set(getAuthHeader(ctx.id, user.id, false, false, user))
          .send({ propertyIds: [property.id] })
          .expect(200);

        await task;

        const [t] = await getTasksByPartyIds(ctx, [party.id]);
        expect(t.state).to.equal(DALTypes.TaskStates.CANCELED);

        const updatedParty = await getPartyBy(ctx, { id: party.id });

        expect(updatedParty.assignedPropertyId).to.equal(property.id);
        expect(updatedParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
      });
    });

    describe('when there are multiple sold properties and we send the request only for one property', () => {
      it('should archive only the parties from the sold property and cancel all the tasks', async () => {
        const user = await createAnAdminUser({ tenantId: ctx.id });

        const property = await createAProperty({}, { endDate: now().toISOString() });
        const party = await createAParty({
          assignedPropertyId: property.id,
        });

        await createATask({ partyId: party.id, userIds: [user.id] });

        const property2 = await createAProperty({}, { endDate: now().toISOString() });
        const party2 = await createAParty({ assignedPropertyId: property2.id });

        await createATask({ partyId: party2.id, userIds: [user.id] });

        const { task } = await setupQueueToWaitFor([], ['party']);

        await request(app)
          .post(`/tenants/${ctx.id}/archivePartiesFromSoldProperties`)
          .set(getAuthHeader(ctx.id, user.id, false, false, user))
          .send({ propertyIds: [property.id] })
          .expect(200);

        await task;

        const [t] = await getTasksByPartyIds(ctx, [party.id]);
        expect(t.state).to.equal(DALTypes.TaskStates.CANCELED);

        const [t2] = await getTasksByPartyIds(ctx, [party2.id]);
        expect(t2.state).to.equal(DALTypes.TaskStates.ACTIVE);

        const updatedParty = await getPartyBy(ctx, { id: party.id });
        expect(updatedParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);

        const updatedParty2 = await getPartyBy(ctx, { id: party2.id });
        expect(updatedParty2.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
      });
    });
  });
});
