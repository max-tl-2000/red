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
import v4 from 'uuid/v4';
import { waitFor } from '../../testUtils/apiHelper';
import { setupConsumers } from '../consumer';
import { chan, tenant, createResolverMatcher } from '../../testUtils/setupTestGlobalContext';
import { saveTenant, deleteTenant } from '../../services/tenantService';
import { addJobHandlers, removeJobHandler, getConfigName, getTopic } from '../tasks/recurringJobs';
import config from '../../config';

chai.use(sinonChai);
const expect = chai.expect;

describe.skip('recurringJobs', () => {
  describe('when setting up consumers', () => {
    it('should set up recurring job for tenant and fire it', async () => {
      const condition = (...args) => {
        const [msg, , amqpMessage] = args;
        return msg.tenantId === tenant.id && amqpMessage.fields.routingKey === getTopic(tenant.id);
      };
      const { resolvers, promises } = waitFor([condition]);
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, [getConfigName(tenant.name)]);

      const result = await Promise.all(promises);
      expect(result.length).to.equal(1);
      expect(result[0]).to.be.true;
    });
  });

  describe('given set up workers for recurring jobs', () => {
    describe('when adding handlers', () => {
      it('they should be called', async () => {
        const spyHandler = sinon.spy();
        addJobHandlers([spyHandler]);

        const condition = (...args) => {
          const [msg, , amqpMessage] = args;
          return msg.tenantId === tenant.id && amqpMessage.fields.routingKey === getTopic(tenant.id);
        };
        const { resolvers, promises } = waitFor([condition]);
        const matcher = createResolverMatcher(resolvers);
        await setupConsumers(chan(), matcher, [getConfigName(tenant.name)]);
        await Promise.all(promises);

        expect(spyHandler).to.have.been.called;
        expect(spyHandler).to.have.been.calledWith(tenant.id);
      });
    });
  });

  describe('given set up workers for recurring jobs', () => {
    describe('when removing handlers', () => {
      it('they should not be called any more', async () => {
        const spyHandler = sinon.spy();
        addJobHandlers([spyHandler]);

        const condition = (...args) => {
          const [msg, , amqpMessage] = args;
          return msg.tenantId === tenant.id && amqpMessage.fields.routingKey === getTopic(tenant.id);
        };
        const { resolvers, promises } = waitFor([condition]);
        const matcher = createResolverMatcher(resolvers);
        await setupConsumers(chan(), matcher, [getConfigName(tenant.name)]);
        await Promise.all(promises);

        spyHandler.reset();
        removeJobHandler(spyHandler);
        await Promise.delay(2 * config.recurringJobs.interval * 1000);

        expect(spyHandler).to.not.have.been.called;
      });
    });
  });

  describe('given set up workers for recurring jobs', () => {
    it('should be recurring, i.e. handlers should be called multiple times', async () => {
      const spyHandler = sinon.spy();
      addJobHandlers([spyHandler]);

      const condition = (...args) => {
        const [msg, , amqpMessage] = args;
        return msg.tenantId === tenant.id && amqpMessage.fields.routingKey === getTopic(tenant.id);
      };

      const { resolvers, promises } = waitFor([condition, condition, condition]);
      const matcher = createResolverMatcher(resolvers);
      await setupConsumers(chan(), matcher, [getConfigName(tenant.name)]);
      await Promise.all(promises);

      expect(spyHandler.callCount).to.be.at.least(3);
    });

    describe('when adding a tenant', () => {
      it('a recurring job should be set up for it', async () => {
        const tenantName = 'anothertesttenant';
        const tenantId = v4();
        const spyHandler = sinon.spy(() => true);
        addJobHandlers([spyHandler]);

        const createTenantCondition = (createTenantMsg, processed, msg) => {
          const matched = createTenantMsg.name === tenantName && !processed && msg.properties.headers['x-reva-recurringJobProcessed'] === true;
          return matched;
        };
        const { resolvers, promises } = waitFor([createTenantCondition]);
        const matcher = createResolverMatcher(resolvers);
        const newTenant = { id: tenantId, name: tenantName };
        await setupConsumers(chan(), matcher, ['sync', getConfigName(newTenant.name)]);

        const savedTenant = await saveTenant({ tenantId: 'admin' }, newTenant);
        await Promise.all(promises);

        expect(spyHandler).to.have.been.calledWith(savedTenant.id);
      });
    });

    describe('when removing a tenant', () => {
      it('the recurring job for it should be removed', async () => {
        const tenantName = 'yetanothertesttenant';
        const spyHandler = sinon.spy();
        addJobHandlers([spyHandler]);

        const savedTenant = await saveTenant({ tenantId: 'admin' }, { name: tenantName });

        let matcher;
        const setupConsumerAndWaitForRecurringJob = async () => {
          const condition = (...args) => {
            const [msg, , amqpMessage] = args;
            return msg.tenantId === savedTenant.id && amqpMessage.fields.routingKey === getTopic(savedTenant.id);
          };
          const { resolvers, promises } = waitFor([condition]);
          matcher = createResolverMatcher(resolvers);
          await setupConsumers(chan(), matcher, ['sync', getConfigName(savedTenant.name)]);
          return { task: Promise.all(promises) };
        };

        const { task } = await setupConsumerAndWaitForRecurringJob();
        await task;
        expect(spyHandler).to.have.been.calledWith(savedTenant.id);

        const removeTenantCondition = removeTenantMsg => {
          const msgTenant = removeTenantMsg.tenant;
          return msgTenant && msgTenant.name === tenantName;
        };

        const { resolvers, promises } = waitFor([removeTenantCondition]);
        matcher.addWaiters(resolvers);

        await deleteTenant({ tenantId: 'admin' }, savedTenant.id);
        await Promise.all(promises);

        spyHandler.reset();
        await Promise.delay(2 * config.recurringJobs.interval * 1000);

        expect(spyHandler).to.not.have.been.calledWith(savedTenant.id);
      });
    });
  });
});
