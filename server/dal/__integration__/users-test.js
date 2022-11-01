/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import { createAUser, createATeam, createATeamMember } from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { getUsersWithRoleFromTeam } from '../usersRepo';
import { REVA_ADMIN_EMAIL } from '../../../common/auth-constants';

const ctx = { tenantId: tenant.id };

const dispatcherRole = {
  functionalRoles: [FunctionalRoleDefinition.LD.name],
};

const applicationApproverRole = {
  functionalRoles: [FunctionalRoleDefinition.LAA.name],
};

describe('when retrieving users with LD role from a team', () => {
  describe('given a single user in that team with the role of LD', () => {
    it('should retrieve that user', async () => {
      const team = await createATeam();
      const teamDispatcher = await createAUser({ name: 'LD' });

      await createATeamMember({ teamId: team.id, userId: teamDispatcher.id, roles: dispatcherRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(1);
      expect(result[0].userId).to.equal(teamDispatcher.id);
    });
  });

  describe('given a single user in that team, who has no functional role', () => {
    it('should retrieve no user', async () => {
      const team = await createATeam();
      const dave = await createAUser({ name: 'Dave' });

      await createATeamMember({ teamId: team.id, userId: dave.id, roles: [] });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(0);
    });
  });

  describe('given a single user in that team, who has a different role than LD', () => {
    it('should retrieve no user', async () => {
      const team = await createATeam();
      const LAA = await createAUser({ name: 'LAA' });

      await createATeamMember({ teamId: team.id, userId: LAA.id, roles: applicationApproverRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(0);
    });
  });

  describe('given a single user in that team with the role of LD, but who is explicitly marked as admin', () => {
    it('should retrieve no user', async () => {
      const team = await createATeam();
      const adminLD = await createAUser({ name: 'LD', metadata: { isAdmin: true } });

      await createATeamMember({ teamId: team.id, userId: adminLD.id, roles: dispatcherRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(0);
    });
  });

  describe('given a single user in that team with the role of LD, who is explicitly marked as not an admin', () => {
    it('should retrieve the user', async () => {
      const team = await createATeam();
      const LD = await createAUser({ name: 'LD', metadata: { isAdmin: false } });

      await createATeamMember({ teamId: team.id, userId: LD.id, roles: dispatcherRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(1);
      expect(result[0].userId).to.equal(LD.id);
    });
  });

  describe("given a single user in that team with the role of LD, who's admin status is not marked explicitly", () => {
    it('should retrieve the user', async () => {
      const team = await createATeam();
      const LD = await createAUser({ name: 'LD', metadata: {} });

      await createATeamMember({ teamId: team.id, userId: LD.id, roles: dispatcherRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(1);
      expect(result[0].userId).to.equal(LD.id);
    });
  });

  describe('given a single user in that team with the role of LD, but who is inactive', () => {
    it('should retrieve no user', async () => {
      const team = await createATeam();
      const LD = await createAUser({ name: 'LD' });

      await createATeamMember({ teamId: team.id, userId: LD.id, inactive: true, roles: dispatcherRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(0);
    });
  });

  describe('given a single user in that team with the role of LD, but who is the reva admin', () => {
    it('should retrieve no user', async () => {
      const team = await createATeam();
      const revaAdmin = await createAUser({ name: 'LD', email: REVA_ADMIN_EMAIL });

      await createATeamMember({ teamId: team.id, userId: revaAdmin.id, roles: dispatcherRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(0);
    });
  });

  describe("given more than one team, each with it's own LD", () => {
    it('should only retrieve the LD from the given team', async () => {
      const team = await createATeam();
      const LD = await createAUser({ name: 'LD' });

      const team2 = await createATeam();
      const LD2 = await createAUser({ name: 'LD2' });

      await createATeamMember({ teamId: team.id, userId: LD.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team2.id, userId: LD2.id, roles: dispatcherRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(1);
      expect(result[0].userId).to.equal(LD.id);
    });
  });

  describe('given one team, with three LDs', () => {
    it('should retrieve all LDs from the given team', async () => {
      const team = await createATeam();
      const LD = await createAUser({ name: 'LD' });
      const LD2 = await createAUser({ name: 'LD2' });
      const LD3 = await createAUser({ name: 'LD3' });
      const user1 = await createAUser({ name: 'Dave' });
      const user2 = await createAUser({ name: 'Bob' });

      await createATeamMember({ teamId: team.id, userId: LD.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: LD2.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: LD3.id, roles: dispatcherRole });
      await createATeamMember({ teamId: team.id, userId: user1.id, roles: [] });
      await createATeamMember({ teamId: team.id, userId: user2.id, roles: applicationApproverRole });

      const result = await getUsersWithRoleFromTeam(ctx, team.id, FunctionalRoleDefinition.LD.name);

      expect(result.length).to.equal(3);
      expect(result.map(u => u.userId).sort()).to.deep.equal([LD.id, LD2.id, LD3.id].sort());
    });
  });
});
