/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import Promise from 'bluebird';
import fs from 'fs';
import path from 'path';
import { processReassignParty } from '../party/reassignPartyHandler';
import { DALTypes } from '../../../common/enums/DALTypes';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';

const readFile = Promise.promisify(fs.readFile);

const loadParty = async () => {
  const text = await readFile(path.join(__dirname, 'data', 'countersignLease/party-with-lease.json'), 'utf8');
  return JSON.parse(text);
};

describe('party/reassign', () => {
  const partyId = newId();
  const newLeasingTeamId = newId();
  const newRSTeamId = newId();
  const newLeasignDispatcherId = newId();
  const newRSDispatcherId = newId();
  const ctx = { tenantId: newId() };
  let party = { id: partyId };

  describe('when the event is not PARTY_TEAM_REASSIGNED', () => {
    it('should return no result', async () => {
      party = await loadParty();
      party.events = [];

      const result = await processReassignParty(ctx, party, '', true);
      expect(result).to.deep.equal({});
    });
  });

  describe('when the party PARTY_TEAM_REASSIGNED is triggerd', () => {
    beforeEach(async () => {
      party = await loadParty();
      party.events = [];
    });

    describe('when the property has no active teams', () => {
      it('should return the shouldArchive flag set to true', async () => {
        party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers: [] } }];

        const result = await processReassignParty(ctx, party, '', true);
        expect(result.shouldArchive).to.be.true;
        expect(result.reason).to.equal(DALTypes.ArchivePartyReasons.PROPERTY_OFFBOARDED);
      });
    });

    describe('having a new lease party with a property that has multiple active teams', () => {
      describe('when the same user is part of a new leasing team', () => {
        it('should return the same user and the new team id', async () => {
          const reassignableTeamMembers = [
            { teamId: newLeasingTeamId, userId: party.userId, functionalRoles: [FunctionalRoleDefinition.LAA.name], teamModule: DALTypes.ModuleType.LEASING },
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
            {
              teamId: newRSTeamId,
              userId: party.userId,
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
            {
              teamId: newRSTeamId,
              userId: newRSDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
          ];
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(party.userId);
          expect(result.teamId).to.equal(newLeasingTeamId);
        });
      });

      describe('when the same user is not part of a new leasing team', () => {
        it('should return the dispatcher of the new leasing team and the new team id', async () => {
          const reassignableTeamMembers = [
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
            {
              teamId: newRSTeamId,
              userId: party.userId,
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
            {
              teamId: newRSTeamId,
              userId: newRSDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
          ];
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(newLeasignDispatcherId);
          expect(result.teamId).to.equal(newLeasingTeamId);
        });
      });

      describe('when the only active team is a resident service team', () => {
        it('should return the same user if exist in the team and the new team id', async () => {
          const reassignableTeamMembers = [
            {
              teamId: newRSTeamId,
              userId: party.userId,
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
            {
              teamId: newRSTeamId,
              userId: newRSDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
          ];
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(party.userId);
          expect(result.teamId).to.equal(newRSTeamId);
        });
      });

      describe('when the only active team is a resident service team', () => {
        it('should return the dispatcher if the user is not part of the team and the new team id', async () => {
          const reassignableTeamMembers = [
            {
              teamId: newRSTeamId,
              userId: newRSDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
          ];
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(newRSDispatcherId);
          expect(result.teamId).to.equal(newRSTeamId);
        });
      });
    });

    describe('having an active lease party with a property that has multiple active teams', () => {
      describe('when the same user is part of a new resident service team', () => {
        it('should return the same user and the new resident service team id', async () => {
          const reassignableTeamMembers = [
            { teamId: newLeasingTeamId, userId: party.userId, functionalRoles: [FunctionalRoleDefinition.LAA.name], teamModule: DALTypes.ModuleType.LEASING },
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
            {
              teamId: newRSTeamId,
              userId: party.userId,
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
            {
              teamId: newRSTeamId,
              userId: newRSDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
          ];
          party.workflowName = DALTypes.WorkflowName.ACTIVE_LEASE;
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(party.userId);
          expect(result.teamId).to.equal(newRSTeamId);
        });
      });

      describe('when the same user is not part of a new resident service team', () => {
        it('should return the dispatcher of the resident service team and the new team id', async () => {
          const reassignableTeamMembers = [
            { teamId: newLeasingTeamId, userId: party.userId, functionalRoles: [FunctionalRoleDefinition.LAA.name], teamModule: DALTypes.ModuleType.LEASING },
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
            {
              teamId: newRSTeamId,
              userId: newRSDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
          ];
          party.workflowName = DALTypes.WorkflowName.ACTIVE_LEASE;
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(newRSDispatcherId);
          expect(result.teamId).to.equal(newRSTeamId);
        });
      });

      describe('when the only active team is a leasing team', () => {
        it('should return the same user if exist in the team and the new team id', async () => {
          const reassignableTeamMembers = [
            { teamId: newLeasingTeamId, userId: party.userId, functionalRoles: [FunctionalRoleDefinition.LAA.name], teamModule: DALTypes.ModuleType.LEASING },
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
          ];
          party.workflowName = DALTypes.WorkflowName.ACTIVE_LEASE;
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(party.userId);
          expect(result.teamId).to.equal(newLeasingTeamId);
        });
      });

      describe('when the only active team is a leasing team', () => {
        it('should return the dispatcher if the user is not part of the team and the new team id', async () => {
          const reassignableTeamMembers = [
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
          ];
          party.workflowName = DALTypes.WorkflowName.ACTIVE_LEASE;
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(newLeasignDispatcherId);
          expect(result.teamId).to.equal(newLeasingTeamId);
        });
      });
    });

    describe('having a renewal lease party with a property that has multiple active teams', () => {
      describe('when a resident service teams is active under the same property', () => {
        it('should return the disptacher and the new resident service team id', async () => {
          const reassignableTeamMembers = [
            { teamId: newLeasingTeamId, userId: party.userId, functionalRoles: [FunctionalRoleDefinition.LAA.name], teamModule: DALTypes.ModuleType.LEASING },
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
            {
              teamId: newRSTeamId,
              userId: party.userId,
              functionalRoles: [FunctionalRoleDefinition.LAA.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
            {
              teamId: newRSTeamId,
              userId: newRSDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.RESIDENT_SERVICES,
            },
          ];
          party.workflowName = DALTypes.WorkflowName.RENEWAL;
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(newRSDispatcherId);
          expect(result.teamId).to.equal(newRSTeamId);
        });
      });

      describe('when a resident service teams is not active under the same property', () => {
        it('should return the dispatcher of the remaining leasing team and the new team id', async () => {
          const reassignableTeamMembers = [
            { teamId: newLeasingTeamId, userId: party.userId, functionalRoles: [FunctionalRoleDefinition.LAA.name], teamModule: DALTypes.ModuleType.LEASING },
            {
              teamId: newLeasingTeamId,
              userId: newLeasignDispatcherId,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
              teamModule: DALTypes.ModuleType.LEASING,
            },
          ];
          party.workflowName = DALTypes.WorkflowName.RENEWAL;
          party.events = [{ event: DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED, metadata: { partyId, reassignableTeamMembers } }];

          const result = await processReassignParty(ctx, party, '', true);
          expect(result.shouldArchive).to.be.undefined;
          expect(result.userId).to.equal(newLeasignDispatcherId);
          expect(result.teamId).to.equal(newLeasingTeamId);
        });
      });
    });
  });
});
