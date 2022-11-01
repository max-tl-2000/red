/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAUser, createAParty, createAPartyMember, testCtx as ctx, createAProperty, createAPerson } from '../../testUtils/repoHelper';
import { updatePartyMember } from '../partyRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPersonResidentStates } from '../personRepo';
import '../../testUtils/setupTestGlobalContext';

describe('dal/personRepo', () => {
  describe('When calling getPersonResidentStates repo', () => {
    let userId;
    let parties;
    let personId;
    let property;

    beforeEach(async () => {
      const user = await createAUser();
      const person = await createAPerson();
      property = await createAProperty();
      userId = user.id;
      personId = person.id;
    });

    const generateExpectedMembers = ({ partyMembers, setEndDateAsNull = false }) =>
      parties.map(({ assignedPropertyId, state, workflowState, workflowName }, index) => ({
        propertyId: assignedPropertyId,
        state,
        workflowState,
        workflowName,
        endDate: setEndDateAsNull ? null : partyMembers[index].endDate,
        vacateDate: partyMembers[index].vacateDate,
        propertyName: property.displayName,
        propertyCity: property?.settings?.marketingLocation?.city ?? null,
        propertyState: property?.settings?.marketingLocation?.state ?? null,
        features: property?.settings?.rxp?.features
          ? {
              paymentModule: property?.settings?.rxp?.features?.paymentModule ?? null,
              maintenanceModule: property?.settings?.rxp?.features?.maintenanceModule ?? null,
            }
          : null,
        propertyTimezone: property.timezone,
      }));

    describe('And (the person is in at least on activeLease party and party member endDate is not null) or (party workflowName is newLease and party state Resident)', async () => {
      let partyMembers;

      beforeEach(async () => {
        const partyObjects = [
          {
            userId,
            workflowState: DALTypes.WorkflowState.ACTIVE,
            workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
            assignedPropertyId: property.id,
          },
        ];
        parties = await Promise.all(partyObjects.map(obj => createAParty(obj)));
        partyMembers = await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));

        const [partyMemberA] = partyMembers;
        const partyMemberAUpdated = await updatePartyMember(ctx, partyMemberA.id, { ...partyMemberA });
        partyMembers = partyMembers.map(i => (i.id === partyMemberAUpdated.id ? partyMemberAUpdated : i));
      });

      it('should return an array with a length of 1', async () => {
        const propertyIds = [property.id];
        const results = await getPersonResidentStates(ctx, personId, propertyIds);

        const expectedMembers = generateExpectedMembers({ partyMembers });
        expect(results).to.have.lengthOf(1);
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('And the person is in a leasing party in futureResident or lease state', async () => {
      let partyMembers;

      beforeEach(async () => {
        const partyObjects = [
          {
            userId,
            state: DALTypes.PartyStateType.FUTURERESIDENT,
            assignedPropertyId: property.id,
          },
          {
            userId,
            state: DALTypes.PartyStateType.LEASE,
            assignedPropertyId: property.id,
          },
        ];
        parties = await Promise.all(partyObjects.map(obj => createAParty(obj)));
        partyMembers = await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
      });

      it('should return an array with a length of 2', async () => {
        const propertyIds = [property.id];
        const results = await getPersonResidentStates(ctx, personId, propertyIds);

        const expectedMembers = generateExpectedMembers({ partyMembers, setEndDateAsNull: true });
        expect(results).to.have.lengthOf(2);
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('And the person is in a activeLease archived', async () => {
      let partyMembers;

      beforeEach(async () => {
        const partyObjects = [
          {
            userId,
            workflowState: DALTypes.WorkflowState.ARCHIVED,
            workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
            assignedPropertyId: property.id,
          },
        ];
        parties = await Promise.all(partyObjects.map(obj => createAParty(obj)));
        partyMembers = await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
      });

      it('should return an array with a length of 1', async () => {
        const propertyIds = [property.id];
        const results = await getPersonResidentStates(ctx, personId, propertyIds);

        const expectedMembers = generateExpectedMembers({ partyMembers, setEndDateAsNull: true });
        expect(results).to.have.lengthOf(1);
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('And party state, workflowState, workflowName do not meet the conditions', async () => {
      beforeEach(async () => {
        const partyObjects = [
          {
            userId,
            state: DALTypes.PartyStateType.CONTACT,
            assignedPropertyId: property.id,
          },
        ];
        parties = await Promise.all(partyObjects.map(obj => createAParty(obj)));
        await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));
      });

      it('should return an empty array', async () => {
        const propertyIds = [property.id];
        const results = await getPersonResidentStates(ctx, personId, propertyIds);
        expect(results).to.have.lengthOf(0);
      });
    });

    describe('And the propertyIds is empty or null', async () => {
      let partyMembers;

      beforeEach(async () => {
        const partyObjects = [
          {
            userId,
            workflowState: DALTypes.WorkflowState.ACTIVE,
            workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
            assignedPropertyId: property.id,
          },
          {
            userId,
            state: DALTypes.PartyStateType.RESIDENT,
            workflowName: DALTypes.WorkflowName.NEW_LEASE,
            assignedPropertyId: property.id,
          },
          {
            userId,
            workflowState: DALTypes.WorkflowState.ARCHIVED,
            workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
            assignedPropertyId: property.id,
          },
          {
            userId,
            state: DALTypes.PartyStateType.FUTURERESIDENT,
            assignedPropertyId: property.id,
          },
          {
            userId,
            state: DALTypes.PartyStateType.LEASE,
            assignedPropertyId: property.id,
          },
        ];
        parties = await Promise.all(partyObjects.map(obj => createAParty(obj)));
        partyMembers = await Promise.all(parties.map(p => createAPartyMember(p.id, { personId })));

        const [partyMemberA] = partyMembers;
        const partyMemberAUpdated = await updatePartyMember(ctx, partyMemberA.id, { ...partyMemberA });
        partyMembers = partyMembers.map(i => (i.id === partyMemberAUpdated.id ? partyMemberAUpdated : i));
      });

      it('should return an array with a length of 5', async () => {
        const propertyIds = null;
        const results = await getPersonResidentStates(ctx, personId, propertyIds);
        const expectedMembers = generateExpectedMembers({ partyMembers });
        expect(results).to.have.lengthOf(5);
        expect(results).to.have.deep.members(expectedMembers);
      });
    });
  });
});
