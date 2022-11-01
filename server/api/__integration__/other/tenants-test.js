/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import newId from 'uuid/v4';
import { mapSeries } from 'bluebird';
import app from '../../api';
import { getAuthHeader, setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { saveTenant, deleteTenant } from '../../../dal/tenantsRepo';
import { getAdminUser, updateUser, getUsers } from '../../../dal/usersRepo';
import { knex } from '../../../database/factory';
import { saveExternalPartyMemberInfo } from '../../../services/externalPartyMemberInfo';
import {
  testCtx as ctx,
  createAUser,
  createAnAdminUser,
  createATeam,
  createATeamMember,
  createATeamPropertyProgram,
  createAProperty,
  createAParty,
  createAPerson,
  createAPartyMember,
} from '../../../testUtils/repoHelper';
import { tenant as testTenant } from '../../../testUtils/test-tenant';
import { compare } from '../../../helpers/crypto';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { ResetPasswordTypes } from '../../../../common/enums/enums';

describe('API/tenant', () => {
  const tenant = {
    name: 'NewClient',
    id: newId(),
    refreshed_at: new Date(),
    metadata: {
      phoneNumbers: [{ phoneNumber: '18138008000', used: true }],
      otherMetadata: 'present',
    },
  };

  const adminCtx = { tenantId: 'admin' };
  let adminUser;
  before(async () => {
    adminUser = await createAnAdminUser(adminCtx);
  });

  const tenantsToRemove = [tenant.id];
  afterEach(async () => {
    await mapSeries(tenantsToRemove, async id => await deleteTenant(adminCtx, id));
  });

  const tenantKeys = [
    'id',
    'name',
    'migrations_path',
    'authorization_token',
    'metadata',
    'created_at',
    'updated_at',
    'refreshed_at',
    'settings',
    'partySettings',
    'isTrainingTenant',
  ];

  describe('POST /tenants', () => {
    it('should respond with status code 200 and tenant entity', async () => {
      const res = await request(app).post('/tenants').set(getAuthHeader('admin', adminUser.id)).send(tenant);

      expect(res.status).to.deep.equal(200);
      expect(res.body).to.have.all.keys(tenantKeys);
    });

    describe('when request contains the password for admin user', () => {
      it('it should save the password', async () => {
        const adminPassword = 'abc';
        const tenantWithPassword = { adminPassword, ...tenant };

        const res = await request(app).post('/tenants').set(getAuthHeader('admin', adminUser.id)).send(tenantWithPassword);

        expect(res.status).to.deep.equal(200);
        const user = await getAdminUser({ tenantId: tenant.id });
        expect(await compare(adminPassword, user.password)).to.be.true;
      });
    });

    describe('when is called by no admin user', () => {
      it('it should respond with status code 403', async () => {
        const res = await request(app).post('/tenants').set(getAuthHeader('admin'));

        expect(res.status).to.deep.equal(403);
      });
    });

    describe('when tenant has an invalid phone number', () => {
      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        const tenantWithPhone = {
          ...tenant,
          metadata: {
            phoneNumbers: [{ phoneNumber: '1145bb68qerew' }],
          },
        };

        const { status, body } = await request(app).post('/tenants').set(getAuthHeader('admin', adminUser.id)).send(tenantWithPhone);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_PHONE_NUMBER');
      });
    });

    describe('when tenant has multiple valid phone numbers', () => {
      it('responds with status code 200 and saved entity has correctly formatted phone number', async () => {
        const tenantWithPhone = {
          ...tenant,
          metadata: {
            phoneNumbers: [{ phoneNumber: '+1 619-738-4381' }, { phoneNumber: '+1 619-738-4382' }],
          },
        };

        const { status, body } = await request(app).post('/tenants').set(getAuthHeader('admin', adminUser.id)).send(tenantWithPhone);

        expect(status).to.equal(200);
        expect(body.metadata.phoneNumbers).to.deep.equal([{ phoneNumber: '16197384381' }, { phoneNumber: '16197384382' }]);
      });
    });

    describe('when reserved tenant', () => {
      it('should respond with status code 400 and RESERVED_TENANT_NAME token', async () => {
        const { status, body } = await request(app)
          .post('/tenants')
          .set(getAuthHeader('admin', adminUser.id))
          .send({ ...tenant, name: 'test' });

        expect(status).to.equal(400);
        expect(body.token).to.equal('RESERVED_TENANT_NAME');
      });
    });

    describe('when tenant name ends with hyphen', () => {
      it('should respond with status code 400 and INVALID_TENANT_NAME token', async () => {
        const { status, body } = await request(app)
          .post('/tenants')
          .set(getAuthHeader('admin', adminUser.id))
          .send({ ...tenant, name: 'tenant-' });

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TENANT_NAME');
      });
    });

    describe('when tenant name starts with hyphen', () => {
      it('should respond with status code 400 and INVALID_TENANT_NAME token', async () => {
        const { status, body } = await request(app)
          .post('/tenants')
          .set(getAuthHeader('admin', adminUser.id))
          .send({ ...tenant, name: '-tenant' });

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TENANT_NAME');
      });
    });

    describe('when tenant name contains illegal characters', () => {
      it('should respond with status code 400 and INVALID_TENANT_NAME token', async () => {
        const { status, body } = await request(app)
          .post('/tenants')
          .set(getAuthHeader('admin', adminUser.id))
          .send({ ...tenant, name: 't&en_ an%t' });

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TENANT_NAME');
      });
    });

    describe('when tenant name does not meet minimum length', () => {
      it('should respond with status code 400 and INVALID_TENANT_NAME token', async () => {
        const { status, body } = await request(app)
          .post('/tenants')
          .set(getAuthHeader('admin', adminUser.id))
          .send({ ...tenant, name: 'ten' });

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TENANT_NAME');
      });
    });
  });

  describe('PATCH /tenants', () => {
    beforeEach(async () => await saveTenant(knex, adminCtx, tenant));

    describe("when the tenant doesn't exist", () => {
      it('responds with status code 404 and TENANT_NOT_FOUND token', async () => {
        const { status, body } = await request(app).patch(`/tenants/${newId()}`).set(getAuthHeader('admin', adminUser.id));

        expect(status).to.equal(404);
        expect(body.token).to.equal('TENANT_NOT_FOUND');
      });
    });

    it('should respond with status code 200 and tenant entity', async () => {
      const delta = {
        metadata: {
          phoneNumbers: [{ phoneNumber: '18138008001' }],
        },
      };

      const { status, body } = await request(app).patch(`/tenants/${tenant.id}`).set(getAuthHeader('admin', adminUser.id)).send(delta);

      expect(status).to.deep.equal(200);
      expect(body).to.have.all.keys(tenantKeys);
      expect(body.metadata.phoneNumbers).to.deep.equal([{ phoneNumber: '18138008001' }]);
    });

    it('should update only specified properties', async () => {
      const delta = {
        metadata: {
          phoneNumbers: [{ phoneNumber: '18138008001' }],
        },
      };

      const { status, body } = await request(app).patch(`/tenants/${tenant.id}`).set(getAuthHeader('admin', adminUser.id)).send(delta);

      expect(status).to.deep.equal(200);

      expect(body.metadata).to.deep.equal({
        phoneNumbers: [{ phoneNumber: '18138008001' }],
        otherMetadata: 'present',
      });
      expect(body.name).to.deep.equal(tenant.name);
      expect(body.id).to.deep.equal(tenant.id);
    });

    describe('when is called by no admin user', () => {
      it('it should respond with status code 403', async () => {
        const res = await request(app).patch(`/tenants/${tenant.id}`).set(getAuthHeader('admin'));

        expect(res.status).to.deep.equal(403);
      });
    });

    describe('when tenant has an invalid phone number', () => {
      it('responds with status code 400 and INVALID_PHONE_NUMBER token', async () => {
        const delta = {
          metadata: {
            phoneNumbers: [{ phoneNumber: '1145bb68qerew' }],
          },
        };

        const { status, body } = await request(app).patch(`/tenants/${tenant.id}`).set(getAuthHeader('admin', adminUser.id)).send(delta);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_PHONE_NUMBER');
      });
    });

    describe('when tenant has a valid phone number', () => {
      it('responds with status code 200 and saved entity has correctly formatted phone number', async () => {
        const delta = {
          metadata: {
            phoneNumbers: [{ phoneNumber: '+1 619-738-4381' }],
          },
        };

        const { status, body } = await request(app).patch(`/tenants/${tenant.id}`).set(getAuthHeader('admin', adminUser.id)).send(delta);

        expect(status).to.equal(200);
        expect(body.metadata.phoneNumbers[0].phoneNumber).to.equal('16197384381');
      });
    });

    describe('when reserved tenant', () => {
      it('should respond with status code 400 and RESERVED_TENANT_NAME token', async () => {
        const delta = { name: 'test' };

        const { status, body } = await request(app).patch(`/tenants/${tenant.id}`).set(getAuthHeader('admin', adminUser.id)).send(delta);

        expect(status).to.equal(400);
        expect(body.token).to.equal('RESERVED_TENANT_NAME');
      });
    });

    describe('when tenant name contains illegal characters', () => {
      it('should respond with status code 400 and INVALID_TENANT_NAME token', async () => {
        const delta = { name: 'invalid tenant name' };

        const { status, body } = await request(app).patch(`/tenants/${tenant.id}`).set(getAuthHeader('admin', adminUser.id)).send(delta);

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TENANT_NAME');
      });
    });
  });

  describe('PATCH /tenants/{id}/passwordForType', () => {
    beforeEach(async () => await saveTenant(knex, adminCtx, tenant));

    describe("when the tenant doesn't exist", () => {
      it('responds with status code 404 and TENANT_NOT_FOUND token', async () => {
        const newPassword = 'abc';

        const { status, body } = await request(app)
          .patch(`/tenants/${newId()}/passwordForType`)
          .set(getAuthHeader('admin', adminUser.id))
          .send({ password: newPassword, type: ResetPasswordTypes.ADMIN });

        expect(status).to.equal(404);
        expect(body.token).to.equal('TENANT_NOT_FOUND');
      });
    });

    describe('when the type is not part of the enum', () => {
      it('responds with status code 404 and VALUE_NOT_PART_OF_THE_ENUM token', async () => {
        const newPassword = 'abc';

        const { status, body } = await request(app)
          .patch(`/tenants/${tenant.id}/passwordForType`)
          .set(getAuthHeader('admin', adminUser.id))
          .send({ password: newPassword });

        expect(status).to.equal(400);
        expect(body.token).to.equal('VALUE_NOT_PART_OF_THE_ENUM');
      });
    });

    describe('when the new admin password is empty', () => {
      it('responds with status code 400 and INVALID_PASSWORD token', async () => {
        const { status, body } = await request(app)
          .patch(`/tenants/${tenant.id}/passwordForType`)
          .set(getAuthHeader('admin', adminUser.id))
          .send({ password: '  ', type: ResetPasswordTypes.ADMIN });

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_PASSWORD');
      });
    });

    describe('when the new admin user password is valid', () => {
      it('responds with status code 200, login attempts is set to 0 and new password is saved', async () => {
        const adminTenantUser = await getAdminUser({ tenantId: tenant.id });
        await updateUser({ tenantId: tenant.id }, adminTenantUser.id, {
          loginAttempts: 3,
        });
        const newPassword = 'abc';

        const { status } = await request(app)
          .patch(`/tenants/${tenant.id}/passwordForType`)
          .set(getAuthHeader('admin', adminUser.id))
          .send({ password: newPassword, type: ResetPasswordTypes.ADMIN });

        const updatedAdminUser = await getAdminUser({ tenantId: tenant.id });

        expect(status).to.equal(200);
        expect(await compare(newPassword, updatedAdminUser.password)).to.be.true;
        expect(updatedAdminUser.loginAttempts).to.equal(0);
      });
    });
  });

  describe('POST /tenants/{id}/clearTenantSchema', () => {
    beforeEach(async () => await saveTenant(knex, adminCtx, tenant));

    describe("when the tenant doesn't exist", () => {
      it('responds with status code 404 and TENANT_NOT_FOUND token', async () => {
        const { status, body } = await request(app).post(`/tenants/${newId()}/clearTenantSchema`).set(getAuthHeader('admin', adminUser.id));

        expect(status).to.equal(404);
        expect(body.token).to.equal('TENANT_NOT_FOUND');
      });
    });

    describe('when the tenant id is valid', () => {
      it('responds with status code 200 and the admin user is saved and tenant schema cleared', async () => {
        const adminTenantUser = await getAdminUser({ tenantId: tenant.id });
        await updateUser({ tenantId: tenant.id }, adminTenantUser.id, {
          password: 'abc',
        });
        await createAUser({ ctx: { tenantId: tenant.id } });

        const condition = msg => msg.tenantIdToClear === tenant.id;
        const { task } = await setupQueueToWaitFor([condition], ['sync']);

        const { status } = await request(app).post(`/tenants/${tenant.id}/clearTenantSchema`).set(getAuthHeader('admin', adminUser.id));
        expect(status).to.equal(200);

        await task;

        const adminUserAfterClear = await getAdminUser({ tenantId: tenant.id });
        expect(adminUserAfterClear.password).to.equal('abc');

        const users = await getUsers({ tenantId: tenant.id });
        expect(users).to.have.length(1);
      });
    });
  });

  describe('GET /tenants returns default tenants', () => {
    describe('when no tenant exists', () => {
      it('should respond with status code 200 and default tenants', async () => {
        const { status, body } = await request(app).get('/tenants').set(getAuthHeader('admin', adminUser.id));

        expect(status).to.deep.equal(200);
        expect(body.tenants).to.have.length(3); // admin, red, test
      });
    });

    describe('GET /tenants returns newly added tenants', () => {
      it('should respond with status code 200', async () => {
        await saveTenant(knex, adminCtx, tenant);
        const { status, body } = await request(app).get('/tenants').set(getAuthHeader('admin', adminUser.id));

        expect(status).to.deep.equal(200);
        expect(body.tenants).to.have.length(4); // admin, red, test + the one created in this test
        expect(body.tenants[0]).to.have.all.keys(tenantKeys);
      });
    });
  });

  describe('DELETE /tenants', () => {
    beforeEach(async () => await saveTenant(knex, adminCtx, tenant));

    it('should respond with status code 200', async () => {
      const { status } = await request(app).delete(`/tenants/${tenant.id}`).set(getAuthHeader('admin', adminUser.id));

      expect(status).to.equal(200);
    });
  });

  describe('GET /tenant/tenantId/programs', () => {
    let tenantAdminUser;
    beforeEach(async () => {
      tenantAdminUser = await createAnAdminUser({ tenantId: testTenant.id });
    });
    describe('when an invalid tenant id is provided', () => {
      it('should respond with status code 400 and INVALID_TENANT_ID token', async () => {
        const { status, body } = await request(app).get('/tenants/123456/programs').set(getAuthHeader('admin', adminUser.id));

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TENANT_ID');
      });
    });

    describe('when is called by no admin user', () => {
      it('it should respond with status code 403', async () => {
        const res = await request(app).get(`/tenants/${testTenant.id}/programs`).set(getAuthHeader('admin'));

        expect(res.status).to.deep.equal(403);
      });
    });

    describe('when programs exist on tenant', () => {
      it('should respond with status code 200 and the "IN" programs along with teamId and propertyId', async () => {
        const { id: teamId } = await createATeam();
        const { id: propertyId } = await createAProperty();
        await createATeamPropertyProgram({
          teamId,
          propertyId,
          commDirection: DALTypes.CommunicationDirection.IN,
        });
        await createATeamPropertyProgram({
          teamId,
          propertyId,
          commDirection: DALTypes.CommunicationDirection.IN,
        });
        await createATeamPropertyProgram({
          teamId,
          propertyId,
          commDirection: DALTypes.CommunicationDirection.OUT,
        });

        const { status, body } = await request(app).get(`/tenants/${testTenant.id}/programs`).set(getAuthHeader(testTenant.id, tenantAdminUser.id));

        expect(status).to.equal(200);
        expect(body.programs.length).to.equal(2);
        expect(body.programs[0].teamId).to.equal(teamId);
        expect(body.programs[0].propertyId).to.equal(propertyId);
      });
    });
  });

  describe('GET /tenant/tenantId/teams', () => {
    let tenantAdminUser;
    beforeEach(async () => {
      tenantAdminUser = await createAnAdminUser({ tenantId: testTenant.id });
    });
    describe('when an invalid tenant id is provided', () => {
      it('should respond with status code 400 and INVALID_TENANT_ID token', async () => {
        const { status, body } = await request(app).get('/tenants/123456/teams').set(getAuthHeader('admin', adminUser.id));

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TENANT_ID');
      });
    });

    describe('when is called by no admin user', () => {
      it('it should respond with status code 403', async () => {
        const res = await request(app).get(`/tenants/${testTenant.id}/teams`).set(getAuthHeader('admin'));

        expect(res.status).to.deep.equal(403);
      });
    });

    describe('when no teams exist on tenant', () => {
      it('should respond with status code 200 and no teams', async () => {
        const { status, body } = await request(app).get(`/tenants/${testTenant.id}/teams`).set(getAuthHeader(testTenant.id, tenantAdminUser.id));

        expect(status).to.equal(200);
        expect(body.teams).to.have.length(0);
      });
    });

    describe('when teams exist on tenant', () => {
      it('should respond with status code 200 and all the teams', async () => {
        const team1 = await createATeam({
          name: 'team1',
          module: 'leasing',
          email: 'test1@test.a',
          phone: '12345678923',
        });
        const team2 = await createATeam({
          name: 'team2',
          module: 'leasing',
          email: 'test2@test.a',
          phone: '16504375757',
        });
        const { status, body } = await request(app).get(`/tenants/${testTenant.id}/teams`).set(getAuthHeader(testTenant.id, tenantAdminUser.id));

        expect(status).to.equal(200);
        expect(body.teams[0].name).to.equal(team1.name);
        expect(body.teams[1].name).to.equal(team2.name);
      });

      it('should respond with status code 200 and all the teams containing the team members', async () => {
        const { id: userId } = await createAUser({ ctx, name: 'alfred' });
        const team1 = await createATeam({
          name: 'team1',
          module: 'leasing',
          email: 'test1@test.a',
          phone: '12345678923',
        });
        await createATeamMember({ teamId: team1.id, userId });

        const { status, body } = await request(app).get(`/tenants/${testTenant.id}/teams`).set(getAuthHeader(testTenant.id, tenantAdminUser.id));

        expect(status).to.equal(200);
        expect(body.teams[0].teamMembers.length).to.equal(1);
      });
    });
  });

  describe('PATCH /tenants/tenantId/teams/teamId', () => {
    let tenantAdminUser;
    beforeEach(async () => {
      tenantAdminUser = await createAnAdminUser({ tenantId: testTenant.id });
    });
    describe('when an invalid team id is specified', () => {
      it('responds with status code 400 and INVALID_TEAM_ID token', async () => {
        const { status, body } = await request(app).patch(`/tenants/${testTenant.id}/teams/123456`).set(getAuthHeader(testTenant.id, tenantAdminUser.id));

        expect(status).to.equal(400);
        expect(body.token).to.equal('INVALID_TEAM_ID');
      });
    });

    describe("when the team doesn't exist", () => {
      it('responds with status code 404 and TEAM_NOT_FOUND token', async () => {
        const { status, body } = await request(app).patch(`/tenants/${testTenant.id}/teams/${newId()}`).set(getAuthHeader(testTenant.id, tenantAdminUser.id));

        expect(status).to.equal(404);
        expect(body.token).to.equal('TEAM_NOT_FOUND');
      });
    });

    describe('when the team exists', () => {
      it('it updates the party routing strategy succesfully', async () => {
        const team1 = await createATeam({
          name: 'team1',
          module: 'leasing',
          email: 'test1@test.a',
          phone: '12345678923',
        });
        const delta = {
          ...team1,
          metadata: {
            partyRoutingStrategy: 'New Party Routing Strategy',
          },
        };

        const { status, body } = await request(app)
          .patch(`/tenants/${testTenant.id}/teams/${team1.id}`)
          .set(getAuthHeader(testTenant.id, tenantAdminUser.id))
          .send(delta);

        expect(status).to.equal(200);
        expect(body.metadata.partyRoutingStrategy).to.equal('New Party Routing Strategy');
      });

      it('it updates the nativeCommsEnabled flag succesfully', async () => {
        const aTeam = await createATeam({
          name: 'aTeam',
          module: 'leasing',
          email: 'aTeam@test.a',
          phone: '12345678923',
        });

        const delta = { metadata: { comms: { nativeCommsEnabled: false } } };

        const { status, body } = await request(app)
          .patch(`/tenants/${testTenant.id}/teams/${aTeam.id}`)
          .set(getAuthHeader(testTenant.id, tenantAdminUser.id))
          .send(delta);

        expect(status).to.equal(200);
        expect(body.metadata.comms.nativeCommsEnabled).to.equal(false);
      });
    });
  });

  describe('POST /tenants/{id}/generateDomainToken', () => {
    describe("when the tenant doesn't exist", () => {
      it('responds with status code 404 and TENANT_NOT_FOUND token', async () => {
        const { status, body } = await request(app).post(`/tenants/${newId()}/generateDomainToken`).set(getAuthHeader('admin', adminUser.id)).send({});

        expect(status).to.equal(400);
        expect(body.token).to.equal('TENANT_NOT_FOUND');
      });
    });

    describe('when the tenant id is valid', () => {
      beforeEach(async () => await saveTenant(knex, adminCtx, tenant));

      describe('and domain is missing', () => {
        it('responds with status code 400 and the MISSING_DOMAIN token', async () => {
          const adminTenantUser = await getAdminUser({ tenantId: tenant.id });
          await updateUser({ tenantId: tenant.id }, adminTenantUser.id, {
            password: 'abc',
          });
          await createAUser({ ctx: { tenantId: tenant.id } });

          const { status, body } = await request(app).post(`/tenants/${tenant.id}/generateDomainToken`).set(getAuthHeader('admin', adminUser.id));

          expect(status).to.equal(400);
          expect(body.token).to.equal('MISSING_DOMAIN');
        });
      });

      it('responds with status code 200 and the generated token', async () => {
        const adminTenantUser = await getAdminUser({ tenantId: tenant.id });
        await updateUser({ tenantId: tenant.id }, adminTenantUser.id, {
          password: 'abc',
        });
        await createAUser({ ctx: { tenantId: tenant.id } });

        const { status, body } = await request(app)
          .post(`/tenants/${tenant.id}/generateDomainToken`)
          .set(getAuthHeader('admin', adminUser.id))
          .send({
            domain: 'testing.reva.tech',
            expiresIn: '1m',
            allowedEndpoints: ['contactUs', 'leads'],
          });

        expect(status).to.equal(200);
        expect(body.token).to.not.be.equal('MISSING_DOMAIN');
      });
    });
  });

  describe('API/migrateRenewalV1', () => {
    let user;
    let person;
    let property;
    const externalId = 'extId1';

    beforeEach(async () => {
      property = await createAProperty();
      person = await createAPerson();
      user = await createAUser();
    });

    const createAnActiveLeaseParty = async () => {
      const activeLeaseParty = await createAParty({
        userId: user.id,
        assignedPropertyId: property.id,
        workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
        state: DALTypes.PartyStateType.RESIDENT,
      });
      const { id: partyMemberId } = await createAPartyMember(activeLeaseParty.id, { personId: person.id });

      await saveExternalPartyMemberInfo(ctx, {
        partyMemberId,
        partyId: activeLeaseParty.id,
        externalId,
        propertyId: property.id,
      });

      return activeLeaseParty;
    };

    const createInFlightRenewalV1 = async () => {
      const renewalParty = await createAParty({
        userId: user.id,
        assignedPropertyId: property.id,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        state: DALTypes.PartyStateType.PROSPECT,
        metadata: { V1RenewalState: DALTypes.V1RenewalState.UNUSED },
      });

      const { id: partyMemberId } = await createAPartyMember(renewalParty.id, { personId: person.id });

      await saveExternalPartyMemberInfo(ctx, {
        partyMemberId,
        partyId: renewalParty.id,
        externalId,
        propertyId: property.id,
      });

      return renewalParty;
    };

    describe('When the renewal id is for a V1 in flight', () => {
      it('should migrate the renewal party to V2', async () => {
        const activeLeaseParty = await createAnActiveLeaseParty();
        const renewalParty = await createInFlightRenewalV1();

        const { status, body: renewalMigratedToV2 } = await request(app)
          .patch(`/tenants/${testTenant.id}/migrateRenewalV1`)
          .set(getAuthHeader('admin', adminUser.id))
          .send({ renewalPartyId: renewalParty.id, activeLeasePartyId: activeLeaseParty.id });

        expect(status).to.equal(200);

        expect(renewalMigratedToV2.partyGroupId).to.equal(activeLeaseParty.partyGroupId);
        expect(renewalMigratedToV2.seedPartyId).to.equal(activeLeaseParty.id);
        expect(renewalMigratedToV2.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);
      });
    });
  });
});
