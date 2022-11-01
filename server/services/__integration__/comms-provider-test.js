/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';
import { isEqual } from 'lodash'; // eslint-disable-line red/no-lodash
import { setupQueueToWaitFor } from '../../testUtils/apiHelper';
import { createAUser } from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { setProviderOps } from '../../workers/communication/adapters/plivoServiceAdapter';
import { getUserByEmail } from '../../dal/usersRepo';
import { saveTenant as saveTenantInDB, updateTenant as updateTenantInDb, getTenantByName, deleteTenant as deleteTenantInDB } from '../../dal/tenantsRepo';
import config from '../../config';
import { saveTenant, updateTenant, deleteTenant } from '../tenantService';
import { admin } from '../../common/schemaConstants';
import { knex } from '../../database/factory';
import { sendMessage } from '../pubsub';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../../helpers/message-constants';

const { cloudEnv, telephony } = config;

chai.use(sinonChai);
const expect = chai.expect;
const TELEPHONY_TOPICS = ['sync', 'telephony'];

describe('comms provider features:', () => {
  let ctx;
  let adminCtx;

  const name = 'testtenantname';

  const subaccount = {
    id: 'SADSFJY',
    authId: 42,
    authToken: 43,
    name: `${cloudEnv}_used_subaccount`,
  };
  const unusedSubaccount = {
    authId: 46,
    authToken: 43,
    name: `${cloudEnv}_unused_subaccount`,
  };

  const application = {
    appId: '44',
    appName: `${cloudEnv}_used_app`,
    resourceUri: '44',
  };
  const unusedApplication = {
    appId: '45',
    appName: `${cloudEnv}_unused_app`,
    resourceUri: '45',
  };
  const anotherEnvsApplication = {
    appId: '49',
    appName: 'anotherEnv_app',
    resourceUri: '49',
  };

  const endpoint = {
    application: application.appId,
    endpointId: 45,
    username: 'admin45',
    isUsedInApp: true,
  };
  const anotherEndpoint = {
    application: application.appId,
    endpointId: 46,
    username: 'admin46',
  };
  const unusedEndpoint = {
    application: application.appId,
    endpointId: 47,
    username: 'admin47',
  };
  const anotherUnusedEndpoint = {
    application: unusedApplication.appId,
    endpointId: 48,
    username: 'admin48',
  };

  const anotherEnvsEndpoint = {
    application: anotherEnvsApplication.appId,
    endpointId: 50,
    username: 'admin50',
  };

  const availablePhoneNumber1 = '16504466621';
  const availablePhoneNumber2 = '16504466623';
  const tenantId = newId();
  const recordingIds = ['recording47', 'recording48'];

  let ops;

  beforeEach(() => {
    ops = {
      createEndpoint: sinon.spy(params => ({
        endpointId: endpoint.endpointId,
        username: params.username,
      })),
      createSubaccount: sinon.spy(() => subaccount),
      updateSubaccount: () => {},
      createApplication: sinon.spy(() => application),
      getAllNumbers: () => [
        { number: availablePhoneNumber1, application: telephony.plivoEmptyAppId },
        { number: availablePhoneNumber2, application: telephony.plivoEmptyAppId },
      ],
      updatePhoneNumber: sinon.spy(),
      getAllApplications: sinon.spy(() => [application, unusedApplication, anotherEnvsApplication]),
      deleteApplications: sinon.spy(),
      getAllSubaccounts: sinon.spy(() => [subaccount, unusedSubaccount]),
      deleteSubaccounts: sinon.spy(),
      getAllEndpoints: sinon.spy(() => [endpoint, anotherEndpoint, unusedEndpoint, anotherUnusedEndpoint, anotherEnvsEndpoint]),
      deleteEndpoints: sinon.spy(),
      deleteApplication: sinon.spy(),
      deleteSubaccount: sinon.spy(),
      deleteRecordings: sinon.spy(),
    };

    setProviderOps(ops);

    ctx = { tenantId: tenant.id };
    adminCtx = { tenantId: admin.id };
  });

  afterEach(async () => await deleteTenantInDB(adminCtx, tenantId));

  describe('when a user registers', () => {
    let largerThan50CharsUserName;
    beforeEach(async () => {
      await updateTenant(ctx.tenantId, {
        metadata: { ...tenant.metadata, enablePhoneSupport: true },
      });

      largerThan50CharsUserName = Array(60).fill('A').join('');
      const user = await createAUser({ name: largerThan50CharsUserName, email: 'test@reva.tech', sipEndpoints: [] });

      const { task } = await setupQueueToWaitFor([msg => msg.user && msg.user.fullName === user.fullName], TELEPHONY_TOPICS);

      await sendMessage({
        exchange: APP_EXCHANGE,
        key: COMM_MESSAGE_TYPE.NEW_USER_REGISTERED,
        message: { ctx, user },
        ctx,
      });

      await task;
    });

    it('SIP endpoint to be used in the app is created', () => expect(ops.createEndpoint).to.have.been.calledOnce);

    it('should call createEndpoint with max 25 characters for username', () =>
      expect(ops.createEndpoint).to.have.been.calledWith(sinon.match({ username: largerThan50CharsUserName.substring(0, 25) })));

    it('should call createEndpoint with max 50 characters for alias', () =>
      expect(ops.createEndpoint).to.have.been.calledWith(sinon.match({ alias: largerThan50CharsUserName.substring(0, 50) })));

    it('SIP credentials are saved', async () => {
      const user = await getUserByEmail(ctx, 'test@reva.tech');
      const userEndpoint = user.sipEndpoints.find(e => e.isUsedInApp);
      expect(userEndpoint).to.be.ok;
      expect(userEndpoint.username).to.deep.equal(largerThan50CharsUserName.substring(0, 25));
      expect(userEndpoint.password).to.be.ok;
      expect(userEndpoint.endpointId).to.be.ok;
    });
  });

  describe('when a tenant is created', () => {
    it('should create tenant profile with comms provider', async () => {
      const { task } = await setupQueueToWaitFor([msg => msg.name === name], TELEPHONY_TOPICS);
      await saveTenant(adminCtx, {
        id: tenantId,
        name,
        metadata: { enablePhoneSupport: true },
      });
      await task;

      expect(ops.createSubaccount).to.have.been.calledOnce;
      expect(ops.createApplication).to.have.been.calledOnce;

      const { metadata } = await getTenantByName(adminCtx, name);
      expect(metadata).to.include.keys(['plivoAppId', 'plivoSubaccountAuthId', 'plivoSubaccountAuthToken']);
    });
  });

  describe('when a tenant is updated', () => {
    let tenantUnderTest;
    beforeEach(async () => {
      tenantUnderTest = await saveTenantInDB(knex, adminCtx, {
        id: tenantId,
        name,
        metadata: {
          plivoAppId: application.appId,
          plivoSubaccountAuthId: subaccount.authId,
          phoneNumbers: [{ phoneNumber: availablePhoneNumber1 }],
          enablePhoneSupport: true,
        },
      });
    });

    const updateTenantPhoneNumbersInDb = phoneNumbers =>
      updateTenantInDb(adminCtx, tenantUnderTest.id, {
        metadata: { ...tenantUnderTest.metadata, phoneNumbers },
      });

    it('phone numbers should be assigned', async () => {
      const { task } = await setupQueueToWaitFor([msg => msg.currentTenant.name === name]);

      await updateTenant(tenantId, {
        metadata: {
          phoneNumbers: [{ phoneNumber: availablePhoneNumber1 }, { phoneNumber: availablePhoneNumber2 }],
          enablePhoneSupport: true,
        },
      });
      await task;

      expect(ops.updatePhoneNumber).to.have.been.calledOnce;
      expect(ops.updatePhoneNumber).to.have.been.calledWith({ number: availablePhoneNumber2, appId: application.appId, subaccount: subaccount.authId });

      const { metadata } = await getTenantByName(adminCtx, name);
      expect(metadata.phoneNumbers).to.deep.equal([{ phoneNumber: availablePhoneNumber1 }, { phoneNumber: availablePhoneNumber2 }]);
    });

    it("should not assign new phone number if it hasn't changed", async () => {
      const { task } = await setupQueueToWaitFor([msg => msg.currentTenant && msg.currentTenant.id === tenantId], TELEPHONY_TOPICS);
      await updateTenant(tenantId, { name: 'newname' });
      await task;

      expect(ops.updatePhoneNumber).to.have.not.been.called;
    });

    it('should assign new phone number and de-assign old phone number', async () => {
      const { task } = await setupQueueToWaitFor([msg => msg.currentTenant && msg.currentTenant.id === tenantId], TELEPHONY_TOPICS);
      await updateTenant(tenantId, {
        metadata: {
          phoneNumbers: [{ phoneNumber: availablePhoneNumber2 }],
        },
      });
      await task;

      expect(ops.updatePhoneNumber).to.have.been.calledTwice;
      expect(ops.updatePhoneNumber).to.have.been.calledWith({ number: availablePhoneNumber1, appId: telephony.plivoEmptyAppId, subaccount: '' });
      expect(ops.updatePhoneNumber).to.have.been.calledWith({ number: availablePhoneNumber2, appId: application.appId, subaccount: subaccount.authId });

      const { metadata } = await getTenantByName(adminCtx, name);
      expect(metadata.phoneNumbers).to.deep.equal([{ phoneNumber: availablePhoneNumber2 }]);
    });

    it('should only de-assign old phone number when new one is empty', async () => {
      const { task } = await setupQueueToWaitFor([msg => msg.currentTenant && msg.currentTenant.id === tenantId], TELEPHONY_TOPICS);
      await updateTenant(tenantId, { metadata: { phoneNumbers: [] } });
      await task;

      expect(ops.updatePhoneNumber).to.have.been.calledOnce;
      expect(ops.updatePhoneNumber).to.have.been.calledWith({ number: availablePhoneNumber1, appId: telephony.plivoEmptyAppId, subaccount: '' });

      const { metadata } = await getTenantByName(adminCtx, name);
      expect(metadata.phoneNumbers).to.deep.equal([]);
    });

    it('should only assign new phone number when old one is empty', async () => {
      await updateTenantPhoneNumbersInDb([]);

      const { task } = await setupQueueToWaitFor([msg => msg.currentTenant && msg.currentTenant.id === tenantId], TELEPHONY_TOPICS);
      await updateTenant(tenantId, {
        metadata: {
          phoneNumbers: [{ phoneNumber: availablePhoneNumber2 }],
        },
      });
      await task;

      expect(ops.updatePhoneNumber).to.have.been.calledOnce;
      expect(ops.updatePhoneNumber).to.have.been.calledWith({ number: availablePhoneNumber2, appId: application.appId, subaccount: subaccount.authId });

      const { metadata } = await getTenantByName(adminCtx, name);
      expect(metadata.phoneNumbers).to.deep.equal([{ phoneNumber: availablePhoneNumber2 }]);
    });

    it('should only assign the new number when adding a new phone number', async () => {
      const task = await setupQueueToWaitFor([msg => msg.currentTenant && msg.currentTenant.id === tenantId], TELEPHONY_TOPICS);
      await updateTenant(tenantId, {
        metadata: {
          phoneNumbers: [{ phoneNumber: availablePhoneNumber1 }, { phoneNumber: availablePhoneNumber2 }],
        },
      });
      await task;

      expect(ops.updatePhoneNumber).to.have.been.calledOnce;
      expect(ops.updatePhoneNumber).to.have.been.calledWith({ number: availablePhoneNumber2, appId: application.appId, subaccount: subaccount.authId });

      const { metadata } = await getTenantByName(adminCtx, name);
      expect(metadata.phoneNumbers).to.deep.equal([{ phoneNumber: availablePhoneNumber1 }, { phoneNumber: availablePhoneNumber2 }]);
    });

    it('should only de-assign the removed number when removing a phone number', async () => {
      await updateTenantPhoneNumbersInDb([{ phoneNumber: availablePhoneNumber1 }, { phoneNumber: availablePhoneNumber2 }]);

      const { task } = await setupQueueToWaitFor([msg => msg.currentTenant && msg.currentTenant.id === tenantId], TELEPHONY_TOPICS);
      await updateTenant(tenantId, {
        metadata: {
          phoneNumbers: [{ phoneNumber: availablePhoneNumber1 }],
        },
      });
      await task;

      expect(ops.updatePhoneNumber).to.have.been.calledOnce;
      expect(ops.updatePhoneNumber).to.have.been.calledWith({ number: availablePhoneNumber2, appId: telephony.plivoEmptyAppId, subaccount: '' });

      const { metadata } = await getTenantByName(adminCtx, name);
      expect(metadata.phoneNumbers).to.deep.equal([{ phoneNumber: availablePhoneNumber1 }]);
    });
  });

  describe('when a tenant is removed', () => {
    beforeEach(async () => {
      await saveTenantInDB(knex, adminCtx, {
        id: tenantId,
        name,
        metadata: {
          plivoAppId: application.appId,
          plivoSubaccountAuthId: subaccount.authId,
          phoneNumbers: [{ phoneNumber: availablePhoneNumber1 }],
          enablePhoneSupport: true,
        },
      });

      await createAUser({
        ctx: { tenantId },
        sipEndpoints: [endpoint, anotherEndpoint],
      });

      const { task } = await setupQueueToWaitFor([msg => msg && msg.tenant.id === tenantId], TELEPHONY_TOPICS);
      await deleteTenant(adminCtx, tenantId, () => recordingIds);
      await task;
    });

    it('should delete all associated endpoints', () => {
      expect(ops.deleteEndpoints).to.have.been.calledWith([endpoint, anotherEndpoint]);
    });

    it('should delete application', () => expect(ops.deleteApplication).to.have.been.calledWith(application.appId));

    it('should delete subaccount', () => expect(ops.deleteSubaccount).to.have.been.calledWith(subaccount.authId));

    it('should delete all voicemail recordings', () => {
      expect(ops.deleteRecordings).to.have.been.calledWith(recordingIds.map(id => ({ id })));
    });
  });

  describe('when a tenant comm provider cleanup is triggered', () => {
    beforeEach(async () => {
      const savedTenant = await saveTenantInDB(knex, adminCtx, {
        id: tenantId,
        name,
        metadata: {
          plivoAppId: application.appId,
          plivoSubaccountAuthId: subaccount.authId,
          phoneNumbers: [{ phoneNumber: availablePhoneNumber1 }],
          enablePhoneSupport: true,
        },
      });

      await createAUser({
        ctx: { tenantId },
        sipEndpoints: [endpoint, anotherEndpoint],
      });

      const msg = {
        phoneSupportEnabled: savedTenant.metadata.enablePhoneSupport,
        endpoints: [endpoint, anotherEndpoint],
        recordingIds,
      };

      const { task } = await setupQueueToWaitFor([m => isEqual(m, msg)], TELEPHONY_TOPICS);
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: COMM_MESSAGE_TYPE.TENANT_COMM_PROVIDER_CLEANUP,
        message: msg,
        ctx: { tenantId },
      });
      await task;
    });

    it('should delete all associated endpoints', () => {
      expect(ops.deleteEndpoints).to.have.been.calledWith([endpoint, anotherEndpoint]);
    });

    it('should delete all voicemail recordings', () => {
      expect(ops.deleteRecordings).to.have.been.calledWith(recordingIds.map(id => ({ id })));
    });
  });

  describe('when a cleanup is triggered for the current env', () => {
    beforeEach(async () => {
      await saveTenantInDB(knex, adminCtx, {
        id: tenantId,
        name,
        metadata: {
          plivoAppId: application.appId,
          plivoSubaccountAuthId: subaccount.authId,
          phoneNumbers: [{ phoneNumber: availablePhoneNumber1 }],
          enablePhoneSupport: true,
        },
      });

      await createAUser({
        ctx: { tenantId },
        sipEndpoints: [endpoint, anotherEndpoint],
      });

      const { task } = await setupQueueToWaitFor([msg => msg === 'cleanup'], TELEPHONY_TOPICS);
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: COMM_MESSAGE_TYPE.COMM_PROVIDER_CLEANUP,
        message: 'cleanup',
        ctx: { tenantId },
      });
      await task;
    });

    it("should retrieve all applications and remove only current env's unused ones", () => {
      expect(ops.getAllApplications).to.have.been.calledOnce;
      expect(ops.deleteApplications).to.have.been.calledWith([unusedApplication]);
    });

    it("should retrieve all subaccounts and remove only current env's unused ones", () => {
      expect(ops.getAllSubaccounts).to.have.been.calledOnce;
      expect(ops.deleteSubaccounts).to.have.been.calledWith([unusedSubaccount]);
    });

    it("should retrieve all endpoints and remove only current env's unused ones", () => {
      expect(ops.getAllEndpoints).to.have.been.calledOnce;
      expect(ops.deleteEndpoints).to.have.been.calledWith([unusedEndpoint, anotherUnusedEndpoint]);
    });
  });
});
