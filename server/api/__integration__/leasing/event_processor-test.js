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
import { tenant, enableAggregationTriggers } from '../../../testUtils/setupTestGlobalContext';
import { createAParty } from '../../../testUtils/repoHelper';
import { processEvents } from '../../events_processor';
import { setEventDeliveryMechanism, resetCallBackUrls } from '../../../workers/party/documentHistoryHandler';
import { getPartyDocumentByPartyId } from '../../../dal/partyDocumentRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { setupQueueToWaitFor, waitFor } from '../../../testUtils/apiHelper';

chai.use(sinonChai);
const expect = chai.expect;
let pgClient;
let resolver;
let eventProcessed;
let delivery;

describe('PUB-SUB/eventsProcessor', () => {
  beforeEach(async () => {
    await enableAggregationTriggers(tenant.id);
    eventProcessed = new Promise(resolve => {
      resolver = resolve;
    });
    delivery = sinon.spy(() => {
      resolver();
      return [];
    });
    setEventDeliveryMechanism(delivery);
    pgClient = await processEvents();
  });

  after(() => {
    resetCallBackUrls();
  });

  afterEach(async () => {
    pgClient && (await pgClient.close());
  });

  describe('when party is created', () => {
    it(`is marked as ${DALTypes.PartyDocumentStatus.SENDING} before being sent`, async () => {
      const partyData = { id: newId() };
      const condition = msg => msg.table === 'PartyDocumentHistory';
      const { task } = await setupQueueToWaitFor([condition], ['history']);
      const party = await createAParty(partyData);
      await task;
      await eventProcessed;

      expect(delivery).to.have.been.called.once;
      const history = await getPartyDocumentByPartyId({ tenantId: tenant.id }, party.id);
      expect(history.status).to.equal(DALTypes.PartyDocumentStatus.SENDING);
    });

    it(`is marked as ${DALTypes.PartyDocumentStatus.SENT} after is delivered`, async () => {
      delivery = sinon.spy(async ({ responseHandler }) => {
        const resp = [{ status: 200 }];
        await responseHandler(resp);
        resolver();
        return resp;
      });
      setEventDeliveryMechanism(delivery);

      const condition = msg => msg.table === 'PartyDocumentHistory';
      const { task } = await setupQueueToWaitFor([condition], ['history']);
      const party = await createAParty();
      await task;
      await eventProcessed;

      expect(delivery).to.have.been.called.once;
      const history = await getPartyDocumentByPartyId({ tenantId: tenant.id }, party.id);
      expect(history.status).to.equal(DALTypes.PartyDocumentStatus.SENT);
    });

    it(`is marked as ${DALTypes.PartyDocumentStatus.FAILED} if delivery fails`, async () => {
      delivery = sinon.spy(async ({ responseHandler }) => {
        const resp = [{ name: 'export', error: 'failed to deliver the notification', status: 400 }];
        await responseHandler(resp);
        resolver();
        return resp;
      });
      setEventDeliveryMechanism(delivery);

      const condition = msg => msg.table === 'PartyDocumentHistory';
      const { task } = await setupQueueToWaitFor([condition], ['history']);
      const party = await createAParty();
      await task;
      await eventProcessed;

      expect(delivery).to.have.been.called.once;
      const history = await getPartyDocumentByPartyId({ tenantId: tenant.id }, party.id);
      expect(history.status).to.equal(DALTypes.PartyDocumentStatus.FAILED);
    });
  });

  describe('when multiple parties are created', () => {
    it(`they are marked as ${DALTypes.PartyDocumentStatus.SENT} after delivery`, async () => {
      const firstParty = { id: newId() };
      const secondParty = { id: newId() };

      let secondResolver;
      const secondEventProcessed = new Promise(resolve => {
        secondResolver = resolve;
      });

      const condition = msg => msg.table === 'PartyDocumentHistory';
      const { task, matcher } = await setupQueueToWaitFor([condition], ['history']);
      delivery = sinon.spy(async ({ document, responseHandler }) => {
        const resp = [{ status: 200 }];
        await responseHandler(resp);

        if (document.partyId === firstParty.id) {
          resolver();
          return resp;
        }
        return [];
      });
      setEventDeliveryMechanism(delivery);

      await createAParty(firstParty);
      await task;
      await eventProcessed;

      expect(delivery).to.have.been.called.once;

      delivery = sinon.spy(async ({ document, responseHandler }) => {
        const resp = [{ status: 200 }];
        await responseHandler(resp);

        if (document.partyId === secondParty.id) {
          secondResolver();
          return resp;
        }
        return [];
      });
      setEventDeliveryMechanism(delivery);

      const { resolvers, promises } = waitFor([condition]);
      matcher.addWaiters(resolvers);

      await createAParty(secondParty);
      await Promise.all(promises);
      await secondEventProcessed;

      expect(delivery).to.have.been.called.once;

      const history = await getPartyDocumentByPartyId({ tenantId: tenant.id }, firstParty.id);
      expect(history.status).to.equal(DALTypes.PartyDocumentStatus.SENT);
    });
  });
});
