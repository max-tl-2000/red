/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, assert } from 'chai';
import { mapSeries } from 'bluebird';
import { createAUser, createAParty, createAPartyMember, createATeam, createATeamMember, createAProperty, testCtx as ctx } from '../../testUtils/repoHelper';
import {
  savePartyAdditionalInfo,
  getPartyAdditionalInfo,
  updatePartyAdditionalInfo,
  getAdditionalInfoByPartyAndType,
  getActivePartyMemberByPartyIdAndPersonId,
  markMemberAsRemoved,
  createRawLead,
  getPartiesToReassignFromInactiveUser,
  loadPartyMembers,
  getActivePartyMembers,
  updatePartyMember,
} from '../partyRepo';
import { deletePartyAdditionalInfo } from '../../services/party';
import { now } from '../../../common/helpers/moment-utils';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../common/enums/DALTypes';

describe('dal/partyRepo', () => {
  let additionalInfo;
  let party;
  let secondParty;

  const initializeAdditionalInfo = async () => {
    const user = await createAUser();
    party = await createAParty({ userId: user.id });
    secondParty = await createAParty({ userId: user.id });

    const info = [
      {
        breed: 'pomeranian',
        weight: '7.7 lbs',
        name: 'Waldo',
      },
      {
        breed: 'pomeranian',
        weight: '7.7 lbs',
        name: 'Sally',
      },
      {
        model: 'lexus',
        color: 'red',
      },
    ];

    additionalInfo = [
      {
        partyId: party.id,
        type: 'pet',
        info: info[0],
      },
      {
        partyId: secondParty.id,
        type: 'pet',
        info: info[1],
      },
      {
        partyId: party.id,
        type: 'car',
        info: info[2],
      },
    ];

    return mapSeries(additionalInfo, async addInfo => await savePartyAdditionalInfo(ctx, addInfo));
  };

  describe('calling getPartiesToReassignFromInactiveUser for a user and team', () => {
    it('should retrieve parties only for the given user', async () => {
      const givenUser = await createAUser();
      const otherUser = await createAUser();
      const team = await createATeam();
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: givenUser.id });
      await createATeamMember({ teamId: team.id, userId: otherUser.id });

      const usersParty = await createAParty({ userId: givenUser.id, ownerTeam: team.id, endDate: null, assignedPropertyId: property.id });
      await createAParty({ userId: otherUser.id, ownerTeam: team.id, endDate: null, assignedPropertyId: property.id });

      const parties = await getPartiesToReassignFromInactiveUser(ctx, givenUser.id, team.id);

      expect(parties.length).to.equal(1);
      expect(parties[0].id).to.equal(usersParty.id);
    });

    it('should retrieve parties only for the given team', async () => {
      const user = await createAUser();
      const team1 = await createATeam();
      const team2 = await createATeam();
      const property = await createAProperty();

      await createATeamMember({ teamId: team1.id, userId: user.id });
      await createATeamMember({ teamId: team2.id, userId: user.id });

      const team1Party = await createAParty({ userId: user.id, ownerTeam: team1.id, endDate: null, assignedPropertyId: property.id });
      await createAParty({ userId: user.id, ownerTeam: team2.id, endDate: null, assignedPropertyId: property.id });

      const parties = await getPartiesToReassignFromInactiveUser(ctx, user.id, team1.id);

      expect(parties.length).to.equal(1);
      expect(parties[0].id).to.equal(team1Party.id);
    });

    it('should retrieve all open parties for the given user and team', async () => {
      const user = await createAUser();
      const team = await createATeam();
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: user.id });

      const openParty1 = await createAParty({ userId: user.id, ownerTeam: team.id, endDate: null, assignedPropertyId: property.id });
      const openParty2 = await createAParty({ userId: user.id, ownerTeam: team.id, endDate: null, assignedPropertyId: property.id });

      const parties = await getPartiesToReassignFromInactiveUser(ctx, user.id, team.id);

      expect(parties.length).to.equal(2);
      expect(parties.map(p => p.id).sort()).to.deep.equal([openParty1.id, openParty2.id].sort());
    });

    it('should retrieve parties closed in the last 30 days for the given user and team', async () => {
      const user = await createAUser();
      const team = await createATeam();
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: user.id });

      const partyClosedToday = await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.CLOSED,
        endDate: now(),
        assignedPropertyId: property.id,
      });
      const partyClosed29DaysAgo = await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.CLOSED,
        endDate: now().subtract(29, 'day'),
        assignedPropertyId: property.id,
      });

      // Also create parties closed more than 30 days ago
      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.CLOSED,
        endDate: now().subtract(31, 'day'),
        assignedPropertyId: property.id,
      });
      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.CLOSED,
        endDate: now().subtract(1, 'year'),
        assignedPropertyId: property.id,
      });

      const parties = await getPartiesToReassignFromInactiveUser(ctx, user.id, team.id);

      expect(parties.length).to.equal(2);
      expect(parties.map(p => p.id).sort()).to.deep.equal([partyClosedToday.id, partyClosed29DaysAgo.id].sort());
    });

    it('should not retrieve parties archived in the last 30 days for the given user and team', async () => {
      const user = await createAUser();
      const team = await createATeam();
      const property = await createAProperty();

      await createATeamMember({ teamId: team.id, userId: user.id });

      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.ARCHIVED,
        archiveDate: now(),
        assignedPropertyId: property.id,
      });
      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.ARCHIVED,
        archiveDate: now().subtract(29, 'day'),
        assignedPropertyId: property.id,
      });

      // Also create parties archived more than 30 days ago
      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.ARCHIVED,
        archiveDate: now().subtract(31, 'day'),
        assignedPropertyId: property.id,
      });
      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        workflowState: DALTypes.WorkflowState.ARCHIVED,
        archiveDate: now().subtract(1, 'year'),
        assignedPropertyId: property.id,
      });

      const parties = await getPartiesToReassignFromInactiveUser(ctx, user.id, team.id);

      expect(parties.length).to.equal(0);
    });

    it('should retrieve parties only from active properties the given user and team', async () => {
      const user = await createAUser();
      const team = await createATeam();

      await createATeamMember({ teamId: team.id, userId: user.id });

      const inactivePropertyData = { endDate: now().toISOString() };
      const inactiveProperty = await createAProperty({}, inactivePropertyData);
      const activeProperty = await createAProperty();

      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        assignedPropertyId: inactiveProperty.id,
      });

      await createAParty({
        userId: user.id,
        ownerTeam: team.id,
        assignedPropertyId: inactiveProperty.id,
      });

      const openPartyOnDifferentProperty = await createAParty({ userId: user.id, ownerTeam: team.id, endDate: null, assignedPropertyId: activeProperty.id });

      const parties = await getPartiesToReassignFromInactiveUser(ctx, user.id, team.id);

      expect(parties.length).to.equal(1);
      expect(parties.map(p => p.id)).to.deep.equal([openPartyOnDifferentProperty.id]);
    });
  });

  describe('calling getPartyAdditionalInfo', () => {
    it('should get the indicated additional info added in the Party_AdditionalInfo table', async () => {
      const savedAdditionalInfo = await initializeAdditionalInfo();
      const result = await getPartyAdditionalInfo(ctx, savedAdditionalInfo[0].id);

      expect(result.partyId).to.equal(additionalInfo[0].partyId);
      expect(result.type).to.equal(additionalInfo[0].type);
      expect(result.info).to.deep.equal(additionalInfo[0].info);
    });
  });

  describe('calling updatetPartyAdditionalInfo', () => {
    it('should update the indicated fields from the info column', async () => {
      const savedAdditionalInfo = await initializeAdditionalInfo();
      const newInfo = { weight: '6 lbs', name: 'Suki' };
      const result = await updatePartyAdditionalInfo(ctx, savedAdditionalInfo[0].id, newInfo);

      expect(result.info.weight).to.equal(newInfo.weight);
      expect(result.info.name).to.equal(newInfo.name);
      expect(result.info.breed).to.equal(savedAdditionalInfo[0].info.breed);
    });
  });

  describe('calling getAdditionalInfoByPartyAndType', () => {
    it('when type is indicated, should return all the additional info added in the Party_AdditionalInfo table by party and type', async () => {
      const savedAdditionalInfo = await initializeAdditionalInfo();
      const result = await getAdditionalInfoByPartyAndType(ctx, party.id, 'pet');

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal(savedAdditionalInfo[0]);
    });

    it('when type is not indicated, should return all the additional info added in the Party_AdditionalInfo table by party', async () => {
      const savedAdditionalInfo = await initializeAdditionalInfo();
      const result = await getAdditionalInfoByPartyAndType(ctx, secondParty.id);

      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal(savedAdditionalInfo[1]);
    });
  });

  describe('calling deletePartyAdditionalInfo', () => {
    it('should delete the indicated additional info', async () => {
      const savedAdditionalInfo = await initializeAdditionalInfo();
      const result = await deletePartyAdditionalInfo(ctx, savedAdditionalInfo[1].id, savedAdditionalInfo[1].partyId);

      const getFirstInfo = await getPartyAdditionalInfo(ctx, savedAdditionalInfo[0].id);
      const getThirdInfo = await getPartyAdditionalInfo(ctx, savedAdditionalInfo[2].id);

      expect(result.endDate).to.not.equal(null);
      expect(getFirstInfo.id).to.equal(savedAdditionalInfo[0].id);
      expect(getThirdInfo.id).to.equal(savedAdditionalInfo[2].id);
    });
  });

  describe('calling getActivePartyMemberByPartyIdAndPersonId', () => {
    describe('when called for a person who is not member of the party', () => {
      it('should return empty', async () => {
        const partyA = await createAParty();
        const partyB = await createAParty();
        const { personId } = await createAPartyMember(partyB.id);

        const result = await getActivePartyMemberByPartyIdAndPersonId({ tenantId: tenant.id }, partyA.id, personId);

        expect(result).to.be.undefined;
      });
    });

    describe('when called for a person who is a member of the party', () => {
      it('should return the correct partyMember record', async () => {
        const partyA = await createAParty();
        const { personId } = await createAPartyMember(partyA.id);

        const result = await getActivePartyMemberByPartyIdAndPersonId({ tenantId: tenant.id }, partyA.id, personId);

        expect(result).not.to.be.undefined;
        expect(result.partyId).to.equal(partyA.id);
        expect(result.personId).to.equal(personId);
        expect(result.endDate).to.be.null;
      });
    });

    describe('when called for a person who is a member of the party', () => {
      describe('after having been a member in the past as well', () => {
        it('should return the correct partyMember records', async () => {
          const partyA = await createAParty();
          const { id, personId } = await createAPartyMember(partyA.id);
          await createAPartyMember(partyA.id, { personId });
          await markMemberAsRemoved({ tenantId: tenant.id }, id);

          const result = await getActivePartyMemberByPartyIdAndPersonId({ tenantId: tenant.id }, partyA.id, personId);

          expect(result).not.to.be.undefined;
          assert.isTrue(result.partyId === partyA.id);
          assert.isTrue(result.personId === personId);
          expect(result.endDate).to.be.null;
        });
      });
    });
  });

  describe('creating a party', () => {
    describe('for a user in a single team', () => {
      it('should set the partys ownerTeam to the users team', async () => {
        const team = await createATeam();
        const person = { fullName: 'Jack Sparrow' };
        const newParty = await createRawLead({
          ctx: { tenantId: tenant.id },
          personData: person,
          collaboratorTeams: [team.id],
          teamsForParty: [team.id],
        });

        expect(newParty).not.to.be.undefined;
        expect(newParty.ownerTeam).to.equal(team.id);
      });
    });

    describe('for a user with multiple teams', () => {
      it('should set the partys ownerTeam to the users first team', async () => {
        const team1 = await createATeam();
        const team2 = await createATeam();
        const person = { fullName: 'Jack Sparrow' };
        const newParty = await createRawLead({
          ctx: { tenantId: tenant.id },
          personData: person,
          collaboratorTeams: [team1.id, team2.id],
          teamsForParty: [team1.id, team2.id],
        });

        expect(newParty).not.to.be.undefined;
        expect(newParty.ownerTeam).to.equal(team1.id);
      });
    });

    describe('from a list of PartyMemberIds', () => {
      describe('when we get the activePartyMembers', () => {
        it('should return only the ids of partyMembers who do not have endDate', async () => {
          const partyA = await createAParty();
          const partyMemberA = await createAPartyMember(partyA.id);
          const partyMemberB = await createAPartyMember(partyA.id);
          const partyMemberC = await createAPartyMember(partyA.id);

          const updatedPartyMemberC = await updatePartyMember({ tenantId: tenant.id }, partyMemberC.id, { ...partyMemberC, endDate: now() });

          const result = await getActivePartyMembers({ tenantId: tenant.id }, new Set([partyMemberA.id, partyMemberB.id, updatedPartyMemberC.id]));

          expect(result.length).to.equal(2);
          expect(result[0].id).to.equal(partyMemberA.id);
          expect(result[1].id).to.equal(partyMemberB.id);
        });

        it('if all partyMembers have endDate, result will be empty', async () => {
          const partyA = await createAParty();
          const partyMemberA = await createAPartyMember(partyA.id);
          const partyMemberB = await createAPartyMember(partyA.id);

          const updatedPartyMemberA = await updatePartyMember({ tenantId: tenant.id }, partyMemberA.id, { ...partyMemberA, endDate: now() });
          const updatedPartyMemberB = await updatePartyMember({ tenantId: tenant.id }, partyMemberB.id, { ...partyMemberB, endDate: now() });

          const result = await getActivePartyMembers({ tenantId: tenant.id }, new Set([updatedPartyMemberA.id, updatedPartyMemberB.id]));

          expect(result.length).to.equal(0);
        });

        it('if the list of PartyMemberIds is empty, result will be empty', async () => {
          const result = await getActivePartyMembers({ tenantId: tenant.id }, new Set([]));

          expect(result.length).to.equal(0);
        });
      });
    });
  });

  describe('calling loadPartyMembers', () => {
    const initializeScenario = async (reAddedPerson = true) => {
      const user = await createAUser();
      const { id: partyId } = await createAParty({ userId: user.id });
      const residentA = await createAPartyMember(partyId);
      let residentB = await createAPartyMember(partyId);
      let residentC;
      if (reAddedPerson) {
        residentB = await markMemberAsRemoved({ tenantId: tenant.id }, residentB.id);
        residentC = await createAPartyMember(partyId, { personId: residentB.personId });
      } else {
        residentC = await createAPartyMember(partyId);
      }

      return { partyId, residentA, residentB, residentC };
    };
    describe('when a person has been readded', () => {
      it('get all residents including inactive ones', async () => {
        const { partyId, residentA, residentB, residentC } = await initializeScenario();

        const results = await loadPartyMembers({ tenantId: tenant.id }, partyId, { excludeInactive: false });
        expect(results).to.lengthOf(2);
        expect(residentB.id).to.not.equal(residentC.id);
        expect(residentB.personId).to.equal(residentC.personId);
        expect(residentB.endDate).to.not.be.null;
        expect(results.map(pm => pm.personId).sort()).to.deep.equal([residentA.personId, residentC.personId].sort());
      });

      it('get all active residents', async () => {
        const { partyId, residentA, residentB, residentC } = await initializeScenario();

        const results = await loadPartyMembers({ tenantId: tenant.id }, partyId, { excludeInactive: true });
        expect(results).to.lengthOf(2);
        expect(residentB.endDate).to.not.be.null;
        expect(results.map(pm => pm.id).sort()).to.deep.equal([residentA.id, residentC.id].sort());
      });
    });

    describe('when any person has been readded', () => {
      it('get all residents including inactive ones', async () => {
        const { partyId, residentA, residentB, residentC } = await initializeScenario(false);
        await markMemberAsRemoved({ tenantId: tenant.id }, residentC.id);

        const results = await loadPartyMembers({ tenantId: tenant.id }, partyId, { excludeInactive: false });
        const removedResident = results.find(pm => pm.id === residentC.id);
        expect(results).to.lengthOf(3);
        expect(removedResident.endDate).to.not.be.null;
        expect(results.map(pm => pm.id).sort()).to.deep.equal([residentA.id, residentB.id, residentC.id].sort());
      });

      it('get all active residents', async () => {
        const { partyId, residentA, residentB, residentC } = await initializeScenario(false);

        const results = await loadPartyMembers({ tenantId: tenant.id }, partyId, { excludeInactive: true });

        expect(results).to.lengthOf(3);
        expect(results.map(pm => pm.id).sort()).to.deep.equal([residentA.id, residentB.id, residentC.id].sort());
      });
    });
  });
});
