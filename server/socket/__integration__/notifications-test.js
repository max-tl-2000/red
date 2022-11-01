/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import io from 'socket.io-client';

import newId from 'uuid/v4';
import chaiAsPromised from 'chai-as-promised';
import config from '../../config';
import { saveTenant, deleteTenant } from '../../dal/tenantsRepo';
import { knex } from '../../database/factory';
import { runServer } from '../socketServer';
import { notify, notifyAll } from '../../../common/server/notificationClient';
import { createJWTToken } from '../../../common/server/jwt-helpers';
import logger from '../../../common/helpers/logger';
// the database needs to be setup for ws notifications
import { tenant } from '../../testUtils/setupTestGlobalContext'; // eslint-disable-line
import sleep from '../../../common/helpers/sleep';

const expect = chai.expect;
chai.use(chaiAsPromised);

const wait = async (timeoutMs = 1000) => new Promise(resolve => setTimeout(() => resolve(), timeoutMs));

const notifyAndWait = async data => {
  await notify(data);
  await wait();
};

const waitForClientEvent = async (client, eventType, timeoutMs = 1000) =>
  new Promise((resolve, reject) => {
    logger.debug('waiting for ws event ', eventType);

    client.on(eventType, msg => {
      logger.debug('received ws event ', eventType, ' with msg ', msg);
      resolve(msg);
    });
    // Set up the timeout
    setTimeout(() => {
      reject(new Error(`timeout while waiting for event of type ${eventType}`));
    }, timeoutMs);
  });

describe('web sockets tests:', () => {
  const host = `ws://localhost:${config.wsPort}`;
  let server;

  function connectToSocketWithToken(socket, token) {
    socket.on('connect', () => {
      socket.emit('authenticate', { token });
    });
  }

  async function createSubscriptionClient(tenantId, userId, teamIds) {
    logger.debug(`createSubscriptionClient to tenantId ${tenantId}`);
    const socket = await io.connect(host, { transports: ['websocket'] });
    // note that unlike most authorization cases in which the creds
    // are transmitted via handshake (prior to completion of the connect)
    const token = createJWTToken({ tenantId, id: userId, teamIds });
    connectToSocketWithToken(socket, token);
    await waitForClientEvent(socket, 'wsClientAuthenticated');

    return socket;
  }

  async function createSocketWithExpiredToken(tenantId, userId, teamIds) {
    logger.info('creating socket with expired token');

    /* create a token that expires in 1 second, then wait 2 seconds to allow it to expire */
    const token = createJWTToken({ tenantId, id: userId, teamIds }, { expiresIn: '1' });
    logger.info('sleeping to allow token to expire ');
    await sleep(2000);

    const socket = await io.connect(host, { transports: ['websocket'] });

    connectToSocketWithToken(socket, token);

    return socket;
  }

  const adminCtx = { tenantId: 'admin' };
  let tenant1;

  beforeEach(async () => {
    tenant1 = newId();
    const newTenant = {
      name: 'NewClient',
      id: tenant1,
      refreshed_at: new Date(),
      metadata: {
        phoneNumbers: [{ phoneNumber: '18138008000', used: true }],
        otherMetadata: 'present',
      },
    };

    await saveTenant(knex, adminCtx, newTenant);
    server = await runServer();
  });

  afterEach(async () => {
    await deleteTenant(adminCtx, tenant1);
    await server.close();
  });

  describe('given a client subscription for an event', () => {
    it.skip('when a notification for that event is triggered, the client is notified', async () => {
      const expectedData = { data: 'test data' };
      const ctx = { tenantId: tenant1 };
      const client = await createSubscriptionClient(tenant1, newId());

      let receivedMsg;
      client.on('event', msg => {
        receivedMsg = msg;
      });
      await notifyAndWait({ ctx, tenantId: tenant1, event: 'event', data: expectedData });

      expect(receivedMsg).to.deep.equal(expectedData);
    });

    it('when a notification for a different event is triggered, the client is NOT notified', async () => {
      const ctx = { tenantId: tenant1 };
      const client = await createSubscriptionClient(tenant1);

      let receivedMsg;
      client.on('event', msg => {
        receivedMsg = msg;
      });
      await notifyAndWait({ ctx, tenantId: tenant1, event: 'event B', data: 'some data' });

      expect(receivedMsg).to.be.undefined;
    });

    it('when a notification for a different tenant is triggered, the client is NOT notified', async () => {
      const tenant2 = newId();
      const ctx2 = { tenantId: tenant2 };
      const client = await createSubscriptionClient(tenant1, newId());

      let receivedMsg;
      client.on('event', msg => {
        receivedMsg = msg;
      });
      await notifyAndWait({ ctx: ctx2, tenantId: tenant2, event: 'event', data: 'some data' });

      expect(receivedMsg).to.be.undefined;
    });

    describe('and there is a routed notification', () => {
      it.skip('when it is routed to the user that is connected, the client is notified', async () => {
        const expectedData = { data: 'test data' };
        const ctx = { tenantId: tenant1 };
        const connectedUserId = newId();
        const client = await createSubscriptionClient(tenant1, connectedUserId);

        let receivedMsg;
        client.on('event', msg => {
          receivedMsg = msg;
        });
        await notifyAndWait({
          ctx,
          tenantId: tenant1,
          event: 'event',
          data: expectedData,
          routing: { users: [connectedUserId] },
        });

        expect(receivedMsg).to.deep.equal(expectedData);
      });

      it('when it is routed to other users than the connected one, the client is not notified', async () => {
        const expectedData = { data: 'test data' };
        const ctx = { tenantId: tenant1 };
        const connectedUserId = newId();
        const anotherUserId = newId();

        const client = await createSubscriptionClient(tenant1, connectedUserId);

        let receivedMsg;
        client.on('event1', msg => {
          receivedMsg = msg;
        });
        await notifyAndWait({
          ctx,
          tenantId: tenant1,
          event: 'event',
          data: expectedData,
          routing: { users: [anotherUserId] },
        });

        expect(receivedMsg, 'the notification should not be received').to.be.undefined;
      });

      it.skip('when it is routed to one of the teams connected, the client is notified', async () => {
        const expectedData = { data: 'test data' };
        const ctx = { tenantId: tenant1 };
        const connectedUserId = newId();
        const teamId1 = newId();
        const teamId2 = newId();
        const teamId3 = newId();
        const connectedTeams = [teamId1, teamId2];
        const notifiedTeams = [teamId1, teamId3];
        const client = await createSubscriptionClient(tenant1, connectedUserId, connectedTeams);

        let receivedMsg;
        client.on('event', msg => {
          logger.debug('received event ', msg);
          receivedMsg = msg;
        });
        await notifyAndWait({
          ctx,
          tenantId: tenant1,
          event: 'event',
          data: expectedData,
          routing: { teams: notifiedTeams },
        });

        expect(receivedMsg).to.deep.equal(expectedData);
      });

      it('when it is routed to other teams than the connected ones, the client is not notified', async () => {
        const expectedData = { data: 'test data' };
        const ctx = { tenantId: tenant1 };
        const connectedUserId = newId();
        const teamId1 = newId();
        const teamId2 = newId();
        const teamId3 = newId();
        const teamId4 = newId();
        const connectedTeams = [teamId1, teamId2];
        const notifiedTeams = [teamId3, teamId4];
        const client = await createSubscriptionClient(tenant1, connectedUserId, connectedTeams);

        let receivedMsg;
        client.on('event', msg => {
          receivedMsg = msg;
        });
        await notifyAndWait({
          ctx,
          tenantId: tenant1,
          event: 'event',
          data: expectedData,
          routing: { teams: notifiedTeams },
        });

        expect(receivedMsg).to.be.undefined;
      });
    });
  });

  describe('given two client subscriptions for an event, from different tenants', () => {
    it.skip('when notification for one tenant is triggered, only one client is notified', async () => {
      const ctx = { tenantId: tenant1 };
      const tenant2 = newId();
      const client1 = await createSubscriptionClient(tenant1, newId());
      const client2 = await createSubscriptionClient(tenant2, newId());

      let receivedMsg1;
      client1.on('event', msg => {
        receivedMsg1 = msg;
      });

      let receivedMsg2;
      client2.on('event', msg => {
        receivedMsg2 = msg;
      });
      await notifyAndWait({ ctx, tenantId: tenant1, event: 'event', data: { data: 'some data' } });

      await expect(receivedMsg1).to.deep.equal({ data: 'some data' });
      expect(receivedMsg2).to.be.undefined;
    });
  });

  describe('given two client subscriptions for an event, from different tenants', () => {
    let tenant2;
    beforeEach(async () => {
      tenant2 = newId();
      const newTenant = {
        name: 'NewClient2',
        id: tenant2,
        refreshed_at: new Date(),
        metadata: {
          phoneNumbers: [{ phoneNumber: '18138008000', used: true }],
          otherMetadata: 'present',
        },
      };

      await saveTenant(knex, adminCtx, newTenant);
    });

    afterEach(async () => {
      await deleteTenant(adminCtx, tenant2);
    });

    it('when a notification is sent to all, all the clients are notified', async () => {
      const client1 = await createSubscriptionClient(tenant1, newId());
      const client2 = await createSubscriptionClient(tenant2, newId());

      let receivedMsg1;
      client1.on('event', msg => {
        receivedMsg1 = msg;
      });
      let receivedMsg2;
      client2.on('event', msg => {
        receivedMsg2 = msg;
      });

      await notifyAll({ event: 'event', data: 'some data' });
      await wait();
      expect(receivedMsg1).to.equal('some data');
      expect(receivedMsg2).to.equal('some data');
    });
  });

  describe('given an expired jwt token', () => {
    it('should fail gracefully', async () => {
      const socket = await createSocketWithExpiredToken(tenant1, newId());
      await waitForClientEvent(socket, 'unauthorized');
    });
  });
});
