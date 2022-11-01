/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAParty, createAPartyMember, createAUser, createAProperty, testCtx as ctx, createAPerson } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { updatePartyMember } from '../party';
import { ResidentPropertyState } from '../../../common/enums/residentPropertyStates';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getResidentState } from '../person';

describe('services/person', () => {
  describe('When calling getResidentState', () => {
    let personId;
    let partyObjects;
    let property;

    beforeEach(async () => {
      const user = await createAUser();
      const person = await createAPerson();
      property = await createAProperty();

      personId = person.id;

      partyObjects = {
        activeLeaseParty: {
          userId: user.id,
          workflowState: DALTypes.WorkflowState.ACTIVE,
          workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
          assignedPropertyId: property.id,
        },
        newLeaseParty: {
          userId: user.id,
          state: DALTypes.PartyStateType.RESIDENT,
          workflowName: DALTypes.WorkflowName.NEW_LEASE,
          assignedPropertyId: property.id,
        },
        activeLeaseArchivedParty: {
          userId: user.id,
          workflowState: DALTypes.WorkflowState.ARCHIVED,
          workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
          assignedPropertyId: property.id,
        },
        futureResidentStateParty: {
          userId: user.id,
          state: DALTypes.PartyStateType.FUTURERESIDENT,
          assignedPropertyId: property.id,
        },
        leaseStateParty: {
          userId: user.id,
          state: DALTypes.PartyStateType.LEASE,
          assignedPropertyId: property.id,
        },
      };
    });

    const generateExpected = ({ residentState }) => ({
      personId,
      propertyId: property.id,
      propertyName: property.displayName,
      propertyState: property?.settings?.marketingLocation?.state ?? null,
      propertyCity: property?.settings?.marketingLocation?.city ?? null,
      residentState,
      features: property?.settings?.rxp?.features
        ? {
            paymentModule: property?.settings?.rxp?.features?.paymentModule ?? null,
            maintenanceModule: property?.settings?.rxp?.features?.maintenanceModule ?? null,
          }
        : null,
      propertyTimezone: property.timezone,
    });

    describe('And the person is in at least on activeLease party and party member endDate is null', () => {
      beforeEach(async () => {
        const { activeLeaseParty, activeLeaseArchivedParty, futureResidentStateParty } = partyObjects;
        const partiesToCreate = [activeLeaseParty, activeLeaseArchivedParty, futureResidentStateParty];
        const parties = await Promise.all(partiesToCreate.map(obj => createAParty(obj)));
        const [partyMemberA] = await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
        await updatePartyMember(ctx, partyMemberA.id, { ...partyMemberA });
      });

      it("should return an array with an object with residentState with 'Current' as value", async () => {
        const propertyIds = [property.id];
        const results = await getResidentState(ctx, personId, propertyIds);
        const expected = generateExpected({ residentState: ResidentPropertyState.CURRENT });
        const expectedMembers = [expected];
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('party workflowName is newLease and party state is Resident', () => {
      beforeEach(async () => {
        const { newLeaseParty } = partyObjects;
        const partiesToCreate = [newLeaseParty];
        const parties = await Promise.all(partiesToCreate.map(obj => createAParty(obj)));
        await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
      });

      it("should return an array with an object with residentState with 'null' as value", async () => {
        const propertyIds = [property.id];
        const results = await getResidentState(ctx, personId, propertyIds);
        const expected = generateExpected({ residentState: null });
        const expectedMembers = [expected];
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('And the person is in a leasing party in futureResident state', () => {
      beforeEach(async () => {
        const { activeLeaseArchivedParty, futureResidentStateParty } = partyObjects;
        const partiesToCreate = [activeLeaseArchivedParty, futureResidentStateParty];
        const parties = await Promise.all(partiesToCreate.map(obj => createAParty(obj)));
        await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
      });

      it("should return an array with an object with residentState with 'future' as value", async () => {
        const propertyIds = [property.id];
        const results = await getResidentState(ctx, personId, propertyIds);
        const expected = generateExpected({ residentState: ResidentPropertyState.FUTURE });
        const expectedMembers = [expected];
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('And the person is in a leasing party in lease state and is not in any activeLease', () => {
      beforeEach(async () => {
        const { activeLeaseArchivedParty, leaseStateParty } = partyObjects;
        const partiesToCreate = [activeLeaseArchivedParty, leaseStateParty];
        const parties = await Promise.all(partiesToCreate.map(obj => createAParty(obj)));
        await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
      });

      it("should return an array with an object with residentState with 'future' as value", async () => {
        const propertyIds = [property.id];
        const results = await getResidentState(ctx, personId, propertyIds);
        const expected = generateExpected({ residentState: ResidentPropertyState.FUTURE });
        const expectedMembers = [expected];
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('And the person is in a activeLease archived', () => {
      beforeEach(async () => {
        const { activeLeaseArchivedParty } = partyObjects;
        const partiesToCreate = [activeLeaseArchivedParty];
        const parties = await Promise.all(partiesToCreate.map(obj => createAParty(obj)));
        await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
      });

      it("should return an array with an object with residentState with 'past' as value", async () => {
        const propertyIds = [property.id];
        const results = await getResidentState(ctx, personId, propertyIds);
        const expected = generateExpected({ residentState: ResidentPropertyState.PAST });
        const expectedMembers = [expected];
        expect(results).to.have.deep.members(expectedMembers);
      });
    });
  });
});
