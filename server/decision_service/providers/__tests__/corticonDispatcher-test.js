/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import CommCompletedDispatcherResponse from './fixtures/CommCompletedDispatcherResponse';
import CommCompletedTenantDispatcherResponse from './fixtures/CommCompletedTenantDispatcherResponse';
import InvalidTenantDispatcherResponse from './fixtures/InvalidTenantDispatcherResponse';
import NonSupportedEvtDispatcherResponse from './fixtures/NonSupportedEvtDispatcherResponse';
import MultipleEventsDispatcherResponse from './fixtures/MultipleEventsDispatcherResponse';
import { DALTypes } from '../../../../common/enums/DALTypes';

const { PartyEventType } = DALTypes;
const { mockModules } = require('test-helpers/mocker').default(jest);
let CorticonDispatcher;
let dispatcher;

const partyUpdatedEvent = { event: PartyEventType.PARTY_UPDATED };
const customMessageEvent = { event: PartyEventType.CUSTOM_MESSAGE };
const personUpdatedEvent = { event: PartyEventType.PERSON_UPDATED };
const contactInfoAddedEvent = { event: PartyEventType.CONTACT_INFO_ADDED };
const contactInfoRemovedEvent = { event: PartyEventType.CONTACT_INFO_REMOVED };
const commCompletedEvent = { event: PartyEventType.COMMUNICATION_COMPLETED };
const tenantId = '90da3a3e-9eef-11eb-8e1e-135448604b79';
const tenantName = 'test';
const ctx = { tenantId, body: { callBackUrl: `https://${tenantName}.local.env.reva.tech` } };

const mockDispatcherRequest = ({ revaDispatcherResponse, tenantDispatcherResponse, decisionServiceList }) => {
  const superagent = {
    set: jest.fn().mockResolvedValue(decisionServiceList),
  };

  jest.resetModules();
  mockModules({
    '../../../../common/helpers/postXML': {
      postXMLWithRetries: jest.fn().mockResolvedValueOnce(revaDispatcherResponse).mockResolvedValueOnce(tenantDispatcherResponse),
    },
    superagent: {
      get: jest.fn().mockImplementation(() => superagent),
    },
  });

  CorticonDispatcher = require('../corticonDispatcher').default;
  dispatcher = new CorticonDispatcher();
};

const defaultDecisionServiceListResponse = () => ({
  body: {
    decisionServices: [
      { name: 'R_RoutingRules' },
      { name: 'R_InboundComm' },
      { name: 'R_OutboundComms' },
      { name: 'R_PartyMembers' },
      { name: 'R_PartyWorflowState' },
      { name: 'R_LackOfInboundComms' },
    ],
  },
});

describe('getDecisionServicesToCall()', () => {
  describe('when a comm event is passed', () => {
    beforeEach(() =>
      mockDispatcherRequest({ revaDispatcherResponse: CommCompletedDispatcherResponse, decisionServiceList: defaultDecisionServiceListResponse() }),
    );

    it('should return a list of decision services for the comm event', async () => {
      const decisionServices = await dispatcher.getDecisionServicesToCall({ ctx, events: [commCompletedEvent] });
      expect(decisionServices.map(({ name }) => name)).toEqual(['R_InboundComm', 'R_OutboundComms']);
    });

    describe('when a comm event is passed with a tenant having a dispatcher', () => {
      beforeEach(() => {
        const decisionServiceList = defaultDecisionServiceListResponse();
        decisionServiceList.body.decisionServices.push({ name: `${tenantName}_RoutingRules` });
        decisionServiceList.body.decisionServices.push({ name: `${tenantName}_OutboundComms` });
        mockDispatcherRequest({
          revaDispatcherResponse: CommCompletedDispatcherResponse,
          tenantDispatcherResponse: CommCompletedTenantDispatcherResponse,
          decisionServiceList,
        });
      });

      it('should return a list of decision services for the comm event with overridden rules', async () => {
        const decisionServices = await dispatcher.getDecisionServicesToCall({ ctx, events: [commCompletedEvent] });
        expect(decisionServices.map(({ name }) => name)).toEqual(['R_InboundComm', `${tenantName}_OutboundComms`]);
      });

      describe('and corticon returns invalid rules for the tenant', () => {
        beforeEach(() => {
          const decisionServiceList = defaultDecisionServiceListResponse();
          decisionServiceList.body.decisionServices.push({ name: `${tenantName}_RoutingRules` });
          decisionServiceList.body.decisionServices.push({ name: 'AnotherTenant_OutboundComms' });
          decisionServiceList.body.decisionServices.push({ name: 'X_DecisionService' });
          mockDispatcherRequest({
            revaDispatcherResponse: CommCompletedDispatcherResponse,
            tenantDispatcherResponse: InvalidTenantDispatcherResponse,
            decisionServiceList,
          });
        });

        it('should return a filtered list of decision services for the comm event and tenant', async () => {
          const decisionServices = await dispatcher.getDecisionServicesToCall({ ctx, events: [commCompletedEvent] });
          expect(decisionServices.map(({ name }) => name)).toEqual(['R_InboundComm', `${tenantName}_PartyMembers`]);
        });
      });
    });
  });
  describe('when an unsupported event is passed', () => {
    beforeEach(() =>
      mockDispatcherRequest({ revaDispatcherResponse: NonSupportedEvtDispatcherResponse, decisionServiceList: defaultDecisionServiceListResponse() }),
    );

    it('should return an empty list of decision services', async () => {
      const decisionServices = await dispatcher.getDecisionServicesToCall({ ctx, events: [partyUpdatedEvent] });
      expect(decisionServices).toEqual([]);
    });
  });
  describe('when a custom message event is passed', () => {
    beforeEach(() => {
      CorticonDispatcher = require('../corticonDispatcher').default;
      dispatcher = new CorticonDispatcher();
    });

    it('should return a list of decision services for the custom message event', async () => {
      const decisionServices = await dispatcher.getDecisionServicesToCall({
        ctx,
        events: [{ ...customMessageEvent, metadata: { ruleName: 'R_LackOfInboundComms' } }],
      });
      expect(decisionServices.map(({ name }) => name)).toEqual(['R_LackOfInboundComms']);
    });

    it('should return an empty list of decision services for a custom message event without rule name metadata', async () => {
      const decisionServices = await dispatcher.getDecisionServicesToCall({
        ctx,
        events: [customMessageEvent],
      });
      expect(decisionServices).toEqual([]);
    });

    it('should return a filtered list of decision services for an invalid custom message event ruleName', async () => {
      const decisionServices = await dispatcher.getDecisionServicesToCall({
        ctx,
        events: [{ ...customMessageEvent, metadata: { ruleName: 'AnotherTenant_LackOfInboundComms' } }],
      });
      expect(decisionServices).toEqual([]);
    });
  });
  describe('when no event is passed', () => {
    it('should return an empty list of decision services', async () => {
      CorticonDispatcher = require('../corticonDispatcher').default;
      dispatcher = new CorticonDispatcher();

      expect(await dispatcher.getDecisionServicesToCall()).toEqual([]);
      expect(await dispatcher.getDecisionServicesToCall(null)).toEqual([]);
    });
  });
  describe('when multiple events are passed', () => {
    beforeEach(() =>
      mockDispatcherRequest({ revaDispatcherResponse: MultipleEventsDispatcherResponse, decisionServiceList: defaultDecisionServiceListResponse() }),
    );

    it('should return a list of decision services based on a list of events', async () => {
      const events = { ctx, events: [personUpdatedEvent, contactInfoAddedEvent, contactInfoRemovedEvent] };
      const decisionServices = await dispatcher.getDecisionServicesToCall(events);
      const expectedDecisionServices = ['R_PartyMembers', 'R_PartyWorflowState'];
      expect(decisionServices.map(({ name }) => name)).toEqual(expectedDecisionServices);
    });
  });
});
