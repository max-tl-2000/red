/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import Promise from 'bluebird';
import newId from 'uuid/v4';
import { waitFor } from '../../testUtils/apiHelper';
import { setupConsumers } from '../consumer';
import { chan, createResolverMatcher } from '../../testUtils/setupTestGlobalContext';
import { saveTenant, deleteTenant } from '../../services/tenantService';
import {
  setRecurringJobHandlerOnCreate,
  setCommsHandlerOnCreate,
  setRecurringJobHandlerOnRemove,
  setCommsHandlerOnRemove,
  setSyncHandlerOnRemove,
  resetHandlers,
} from '../tenantHandler';

chai.use(sinonChai);
const expect = chai.expect;

describe('tenantHandler', () => {
  let conn;
  let matcher;

  const setupQueueForMessage = async condition => {
    conn = chan();

    const { resolvers, promises } = waitFor([condition]);
    matcher = createResolverMatcher(resolvers);
    await setupConsumers(conn, matcher, ['sync'], true, 3);

    return { task: Promise.all(promises) };
  };

  describe('when creating a tenant', () => {
    afterEach(() => resetHandlers());

    it('should process the sync message', async () => {
      const tenantId = newId();
      const tenant = {
        id: tenantId,
        name: `syncTenant${tenantId}`,
        metadata: { phoneNumbers: [] },
      };
      const condition = (payload, processed, msg) => {
        const retryCount = msg.properties.headers.retryCount || 0;
        const matched = payload.id === tenantId && processed && retryCount === 0;
        return matched;
      };

      const { task } = await setupQueueForMessage(condition);

      const recurringJobHandlerOnCreate = sinon.spy(() => ({
        processed: true,
      }));
      setRecurringJobHandlerOnCreate(recurringJobHandlerOnCreate);

      const commsHandlerOnCreate = sinon.spy(() => ({ processed: true }));
      setCommsHandlerOnCreate(commsHandlerOnCreate);

      await saveTenant({ tenantId: 'admin' }, tenant);
      const result = await task;
      expect(result.length).to.equal(1);
      expect(result[0]).to.be.true;
    });

    it('will skip recuring job setup if already run', async () => {
      const name = `syncTenant${newId()}`;

      const condition = (payload, processed, msg) => {
        const retryCount = msg.properties.headers.retryCount || 0;
        const matched = payload.name === name && processed === false && retryCount === 2;
        return matched;
      };

      const { task } = await setupQueueForMessage(condition);

      const recurringJobHandlerOnCreate = sinon.spy(() => ({
        processed: true,
      }));
      setRecurringJobHandlerOnCreate(recurringJobHandlerOnCreate);

      const commsHandlerOnCreate = sinon.spy(() => ({ processed: false }));
      setCommsHandlerOnCreate(commsHandlerOnCreate);

      await saveTenant({ tenantId: 'admin' }, { name, metadata: { phoneNumbers: [] } });

      const result = await task;
      expect(result.length).to.equal(1);
      expect(result[0]).to.be.true;
      expect(recurringJobHandlerOnCreate).to.have.been.calledOnce;
      expect(commsHandlerOnCreate).to.have.been.calledThrice;
    });
  });

  describe('when deleting a tenant', () => {
    let savedTenant;
    let name;

    beforeEach(async () => {
      resetHandlers();
      name = `syncTenant${newId()}`;
      const condition = (payload, processed, msg) => {
        const retryCount = msg.properties.headers.retryCount || 0;
        const matched = payload.name === name && retryCount === 0 && msg.fields.routingKey === 'tenant_created';
        return matched;
      };

      const { task } = await setupQueueForMessage(condition);

      const recurringJobHandlerOnCreate = sinon.spy(() => ({
        processed: true,
      }));
      setRecurringJobHandlerOnCreate(recurringJobHandlerOnCreate);

      const commsHandlerOnCreate = sinon.spy(() => ({ processed: true }));
      setCommsHandlerOnCreate(commsHandlerOnCreate);

      savedTenant = await saveTenant({ tenantId: 'admin' }, { name, metadata: { phoneNumbers: [] } });
      await task;
    });

    it('should process the sync message', async () => {
      const condition = (payload, processed, msg) => {
        const retryCount = msg.properties.headers.retryCount || 0;
        const matched = payload.tenant && payload.tenant.name === name && processed && retryCount === 0 && msg.fields.routingKey === 'tenant_removed';
        return matched;
      };

      const { resolvers, promises } = waitFor([condition]);
      matcher.addWaiters(resolvers);

      await deleteTenant({ tenantId: 'admin' }, savedTenant.id);

      const result = await promises[0];
      expect(result).to.be.true;
    });

    it('will skip recuring job setup if already run', async () => {
      const condition = (payload, processed, msg) => {
        const retryCount = msg.properties.headers.retryCount || 0;
        const matched = payload.tenant && payload.tenant.name === name && !processed && retryCount === 2 && msg.fields.routingKey === 'tenant_removed';
        return matched;
      };

      const { resolvers, promises } = waitFor([condition]);
      matcher.addWaiters(resolvers);

      const recurringJobHandlerOnRemove = sinon.spy(() => ({
        processed: true,
      }));
      setRecurringJobHandlerOnRemove(recurringJobHandlerOnRemove);

      const commsHandlerOnRemove = sinon.spy(() => ({ processed: false }));
      setCommsHandlerOnRemove(commsHandlerOnRemove);

      const syncHandlerOnRemove = sinon.spy(() => ({ processed: false }));
      setSyncHandlerOnRemove(syncHandlerOnRemove);

      await deleteTenant({ tenantId: 'admin' }, savedTenant.id);

      const result = await promises[0];
      expect(result).to.be.true;
      expect(recurringJobHandlerOnRemove).to.have.been.calledOnce;
      expect(syncHandlerOnRemove).to.have.been.calledThrice;
      expect(commsHandlerOnRemove).to.not.have.been.called;
    });

    it('will skip sync handler if already run', async () => {
      const condition = (payload, processed, msg) => {
        const retryCount = msg.properties.headers.retryCount || 0;
        const matched = payload.tenant && payload.tenant.name === name && !processed && retryCount === 2 && msg.fields.routingKey === 'tenant_removed';
        return matched;
      };

      const { resolvers, promises } = waitFor([condition]);
      matcher.addWaiters(resolvers);

      const recurringJobHandlerOnRemove = sinon.spy(() => ({
        processed: true,
      }));
      setRecurringJobHandlerOnRemove(recurringJobHandlerOnRemove);

      const commsHandlerOnRemove = sinon.spy(() => ({ processed: false }));
      setCommsHandlerOnRemove(commsHandlerOnRemove);

      const syncHandlerOnRemove = sinon.spy(() => ({ processed: true }));
      setSyncHandlerOnRemove(syncHandlerOnRemove);

      await deleteTenant({ tenantId: 'admin' }, savedTenant.id);

      const result = await promises[0];
      expect(result).to.be.true;
      expect(recurringJobHandlerOnRemove).to.have.been.calledOnce;
      expect(syncHandlerOnRemove).to.have.been.calledOnce;
      expect(commsHandlerOnRemove).to.have.been.calledThrice;
    });
  });
});
