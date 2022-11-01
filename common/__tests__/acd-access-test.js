/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newUUID from 'uuid/v4';
import Immutable from 'immutable';
import { allowedToModifyParty, getCommunicationsAccessibleByUser, getAppointmentsAccessibleByUser } from '../acd/access';

describe('acd-access-tests', () => {
  describe('when allowedToModifyParty is called', () => {
    describe('for a user and a party he owns', () => {
      it('should return true', () => {
        const user = { id: newUUID() };
        const canModifyParty = allowedToModifyParty(user, { userId: user.id });
        expect(canModifyParty).to.equal(true);
      });

      describe('and party owner is inactive', () => {
        it('should return true', () => {
          const user = { id: newUUID() };
          const canModifyParty = allowedToModifyParty(user, { userId: user.id });
          expect(canModifyParty).to.equal(true);
        });
      });
    });

    describe('for a user and a party he does not own but collaborates with', () => {
      it('should return true', () => {
        const user = { id: newUUID() };
        const canModifyParty = allowedToModifyParty(user, {
          userId: newUUID(),
          collaborators: [user.id],
        });
        expect(canModifyParty).to.equal(true);
      });
    });

    describe('for a user and a party his teammate collaborates with', () => {
      it('should return true', () => {
        const team = { id: newUUID() };
        const owner = { id: newUUID() };
        const collaborator = { id: newUUID(), teams: [{ id: team.id }] };
        const collaboratorsTeammate = { id: newUUID(), teams: [{ id: team.id }] };

        const canModifyParty = allowedToModifyParty(collaboratorsTeammate, {
          userId: owner.id,
          collaborators: [collaborator.id],
          teamsAllowedToModify: [team.id],
        });
        expect(canModifyParty).to.equal(true);
      });
    });

    describe('for a user and a party he does not own, is not teammate with its owner, nor any of its collaborators', () => {
      it('should return false', () => {
        const team = { id: newUUID() };
        const owner = { id: newUUID() };
        const collaborator = { id: newUUID(), teams: [{ id: team.id }] };
        const collaboratorsTeammate = { id: newUUID(), teams: [{ id: newUUID() }] };

        const canModifyParty = allowedToModifyParty(collaboratorsTeammate, {
          userId: owner.id,
          collaborators: [collaborator.id],
          teamsAllowedToModify: [team.id],
        });
        expect(canModifyParty).to.equal(false);
      });
    });

    describe('for a user and a party he does not own, and does not collaborate with', () => {
      it('should return false', () => {
        const canModifyParty = allowedToModifyParty({ id: newUUID() }, { userId: newUUID() });
        expect(canModifyParty).to.equal(false);
      });
      it('should return true if the party assignedPropertyId is a property managed by the user and if the party team is in the associatedTeams of the user teams', () => {
        const user = { id: newUUID(), associatedTeams: [{ id: newUUID() }], properties: [{ id: newUUID() }] };
        const party = { id: newUUID(), assignedPropertyId: user.properties[0].id, ownerTeam: user.associatedTeams[0].id };
        const canModifyParty = allowedToModifyParty(user, party);
        expect(canModifyParty).to.equal(true);
      });
    });

    describe('for a user and a party he does not own, does not collaborate with', () => {
      describe('and there is no team to which the party is assigned to, and which contains the user and the party owner', () => {
        it('should return false', () => {
          const team1 = { id: newUUID() };
          const team2 = { id: newUUID() };
          const team3 = { id: newUUID() };

          const loggedInUser = { id: newUUID(), teams: [team1] };
          const owner = { id: newUUID(), teams: [team2] };
          const party = {
            userId: owner.id,
            teams: [team1.id, team2.id, team3.id],
            teamsAllowedToModify: [team3.id],
          };

          const canModifyParty = allowedToModifyParty(loggedInUser, party);
          expect(canModifyParty).to.equal(false);
        });
      });

      describe('and the team to which the party is assigned has the user as an LA and the party owner as an LA', () => {
        it('should return true', () => {
          const team = { id: newUUID() };

          const loggedInUser = {
            id: newUUID(),
            teams: [{ id: team.id, mainRoles: ['LA'] }],
            teamsAllowedToModify: [team.id],
          };
          const partyOwner = {
            id: newUUID(),
            teams: [{ id: team.id, mainRoles: ['LA'] }],
          };
          const party = { userId: partyOwner.id, teams: [team.id], teamsAllowedToModify: [team.id] };

          const canModifyParty = allowedToModifyParty(loggedInUser, party);
          expect(canModifyParty).to.equal(true);
        });
      });
    });
  });

  describe('when getCommunicationsAccessibleByUser is called', () => {
    const personId = newUUID();
    const users = [
      {
        id: '1',
        teams: [{ id: '1', mainRoles: ['LM', 'LA'] }],
      },
      {
        id: '2',
        teams: [
          { id: '1', mainRoles: ['LA'] },
          { id: '2', mainRoles: ['LM'] },
        ],
      },
      {
        id: '3',
        teams: [{ id: '3', mainRoles: ['LA'] }],
      },
    ];
    const parties = [
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
      {
        id: '4',
        userId: '3',
        collaborators: '1',
      },
    ];

    const currentUser = users[0];
    const usersMap = users.map(user => [user.id, user]);
    const partiesMap = parties.map(party => [party.id, party]);

    describe('for person that has direct communications with the user ', () => {
      it('should return all direct comms that include the person', () => {
        const communications = [
          {
            id: '1',
            userId: currentUser.id,
            persons: [newUUID()],
            parties: ['1'],
          },
          {
            id: '2',
            userId: currentUser.id,
            persons: [personId, newUUID()],
            parties: ['1'],
          },
          {
            id: '3',
            userId: currentUser.id,
            persons: [personId],
            parties: ['1'],
          },
        ];
        const communicationsMap = communications.map(comm => [comm.id, comm]);
        const communicationsAccessibleByUser = getCommunicationsAccessibleByUser(
          currentUser,
          personId,
          new Immutable.Map(usersMap),
          new Immutable.Map(communicationsMap),
          new Immutable.Map(partiesMap),
        );
        expect(communicationsAccessibleByUser.size).to.equal(2);
        expect(communicationsAccessibleByUser.has('2')).to.equal(true);
        expect(communicationsAccessibleByUser.has('3')).to.equal(true);
      });
    });

    describe('for a person who is member of a party associated with the current user team(s)', () => {
      it('should return all comms including that person', () => {
        const communications = [
          {
            id: '1',
            userId: '2',
            persons: [newUUID()],
            parties: ['1'],
          },
          {
            id: '2',
            userId: '2',
            persons: [personId, newUUID()],
            parties: ['1'],
          },
          {
            id: '3',
            userId: '3',
            persons: [personId, newUUID()],
            parties: ['3'],
          },
        ];
        const communicationsMap = communications.map(comm => [comm.id, comm]);
        const communicationsAccessibleByUser = getCommunicationsAccessibleByUser(
          currentUser,
          personId,
          new Immutable.Map(usersMap),
          new Immutable.Map(communicationsMap),
          new Immutable.Map(partiesMap),
        );
        expect(communicationsAccessibleByUser.size).to.equal(1);
        expect(communicationsAccessibleByUser.has('2')).to.equal(true);
      });
    });

    describe('for a person who is member of a party that the user collaborated with', () => {
      it('should return all comms that include that person', () => {
        const communications = [
          {
            id: '1',
            userId: '2',
            persons: [newUUID()],
            parties: ['3'],
          },
          {
            id: '2',
            userId: '3',
            persons: [personId, newUUID()],
            parties: ['4'],
          },
        ];
        const communicationsMap = communications.map(comm => [comm.id, comm]);
        const communicationsAccessibleByUser = getCommunicationsAccessibleByUser(
          currentUser,
          personId,
          new Immutable.Map(usersMap),
          new Immutable.Map(communicationsMap),
          new Immutable.Map(partiesMap),
        );
        expect(communicationsAccessibleByUser.size).to.equal(1);
        expect(communicationsAccessibleByUser.has('2')).to.equal(true);
      });
    });

    describe('for a person that is not member of any party associated with the current user team(s)', () => {
      it('should return empty list', () => {
        const communications = [
          {
            id: '1',
            userId: '3',
            persons: [personId],
            parties: ['3'],
          },
          {
            id: '2',
            userId: '3',
            persons: [personId],
            parties: ['3'],
          },
        ];
        const communicationsMap = communications.map(comm => [comm.id, comm]);
        const communicationsAccessibleByUser = getCommunicationsAccessibleByUser(
          currentUser,
          personId,
          new Immutable.Map(usersMap),
          new Immutable.Map(communicationsMap),
          new Immutable.Map(partiesMap),
        );
        expect(communicationsAccessibleByUser.size).to.equal(0);
      });
    });
  });

  describe('when getAppointmentsAccessibleByUser is called', () => {
    const users = [
      {
        id: '1',
        teams: [{ id: '1', mainRoles: ['LM', 'LA'] }],
      },
      {
        id: '2',
        teams: [
          { id: '1', mainRoles: ['LA'] },
          { id: '2', mainRoles: ['LM'] },
        ],
      },
      {
        id: '3',
        teams: [{ id: '3', mainRoles: ['LA'] }],
      },
    ];
    const parties = [
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
      {
        id: '3',
        userId: '3',
      },
      {
        id: '4',
        userId: '3',
        collaborators: '1',
      },
    ];
    const members = [
      { id: '1', personId: '1' },
      { id: '2', personId: '2' },
    ];

    const currentUser = users[0];
    const usersMap = users.map(user => [user.id, user]);
    const partiesMap = parties.map(party => [party.id, party]);
    const membersMap = members.map(member => [member.id, member]);

    describe('for a person who has appointments in parties related to the current user team(s) ', () => {
      it('should return all appointments that include the person', () => {
        const appointments = [
          {
            id: '1',
            userIds: ['1'],
            partyId: '1',
            metadata: { partyMembers: ['1'] },
          },
          {
            id: '2',
            userIds: ['1'],
            partyId: '1',
            metadata: { partyMembers: ['2'] },
          },
        ];
        const appointmentsMap = appointments.map(app => [app.id, app]);
        const appointmentsAccessibleByUser = getAppointmentsAccessibleByUser(
          currentUser,
          new Immutable.Map(appointmentsMap),
          '2',
          new Immutable.Map(membersMap),
          new Immutable.Map(partiesMap),
          new Immutable.Map(usersMap),
          [],
        );

        expect(appointmentsAccessibleByUser.size).to.equal(1);
        expect(appointmentsAccessibleByUser.has('2')).to.equal(true);
      });
    });

    describe('for a person who has appointments in parties NOT related to any of the current user team(s) ', () => {
      it('should return no appointments', () => {
        const appointments = [
          {
            id: '1',
            userIds: ['1'],
            partyId: '1',
            metadata: { partyMembers: ['1'] },
          },
          {
            id: '2',
            userIds: ['3'],
            partyId: '3',
            metadata: { partyMembers: ['2'] },
          },
        ];
        const appointmentsMap = appointments.map(app => [app.id, app]);
        const appointmentsAccessibleByUser = getAppointmentsAccessibleByUser(
          currentUser,
          new Immutable.Map(appointmentsMap),
          '2',
          new Immutable.Map(membersMap),
          new Immutable.Map(partiesMap),
          new Immutable.Map(usersMap),
          [],
        );

        expect(appointmentsAccessibleByUser.size).to.equal(0);
      });
    });
  });
});
