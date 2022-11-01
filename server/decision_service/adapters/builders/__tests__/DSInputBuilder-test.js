/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DSInputBuilder } from '../DSInputBuilder.js';
import OutboundCallEvent from './fixtures/OutboundCallEvent.json';
import InboundCallEvent from './fixtures/InboundCallEvent.json';
import LeaseCountersignEvent from './fixtures/LeaseCountersignEvent.json';
import LeaseVoidedEvent from './fixtures/LeaseVoidedEvent.json';
import TaskAddedEvent from './fixtures/TaskAddedEvent.json';
import LeaseRenewalCreatedEvent from './fixtures/LeaseRenewalCreatedEvent.json';
import LeaseRenewalQuotePrintEvent from './fixtures/LeaseRenewalQuotePrintEvent.json';
import OutboundCallEventInput from './snapshots/OutboundCallEvent.json';
import InboundCallEventInput from './snapshots/InboundCallEvent.json';
import EmptyPartyDocInput from './snapshots/EmptyPartyDoc.json';
import LeaseCountersignInput from './snapshots/LeaseCountersignEvent.json';
import TaskAddedEventInput from './snapshots/TaskAddedEvent.json';
import LeaseVoidedEventInput from './snapshots/LeaseVoidedEvent.json';
import LeaseRenewalCreatedEventInput from './snapshots/LeaseRenewalCreatedEvent.json';
import LeaseRenewalQuotePrintInput from './snapshots/LeaseRenewalQuotePrintEvent.json';

const dsInputBuilder = new DSInputBuilder();
const ctx = {
  body: {
    id: '76e2a2e8-f431-11e9-ae2b-6f90233d2346',
  },
};

describe('DSInputBuilder.build()', () => {
  describe('when building the input and no party doc is passed', () => {
    it('should return an empty object', () => {
      const input = dsInputBuilder.build();
      expect(input).toEqual({});
    });
  });
  describe('when building the input for an empty party doc', () => {
    it('should return an empty input object', () => {
      const input = dsInputBuilder.build(ctx, {});
      expect(input).toEqual(EmptyPartyDocInput);
    });
  });
  describe('when building the input for an outbound comm event', () => {
    it('should return an input object with the outbound comm', () => {
      const input = dsInputBuilder.build(ctx, OutboundCallEvent);
      expect(input).toEqual(OutboundCallEventInput);
    });
  });
  describe('when building the input for an inbound comm event', () => {
    it('should return an input object with the inbound comm', () => {
      const input = dsInputBuilder.build(ctx, InboundCallEvent);
      expect(input).toEqual(InboundCallEventInput);
    });
  });
  describe('when building the input for a lease countersignin event', () => {
    it('should return an input object with the submitted lease', () => {
      const input = dsInputBuilder.build(ctx, LeaseCountersignEvent);
      expect(input).toEqual(LeaseCountersignInput);
    });
  });
  describe('when building the input for a lease void event', () => {
    it('should return an input object with the voided lease', () => {
      const input = dsInputBuilder.build(ctx, LeaseVoidedEvent);
      expect(input).toEqual(LeaseVoidedEventInput);
    });
  });
  describe('when building the input for a task added event', () => {
    it('should return an input object with the new task', () => {
      const input = dsInputBuilder.build(ctx, TaskAddedEvent);
      expect(input).toEqual(TaskAddedEventInput);
    });
  });
  describe('when building the input for a lease renewal created event', () => {
    it('should return an input object with the active lease data', () => {
      const input = dsInputBuilder.build(ctx, LeaseRenewalCreatedEvent);
      expect(input).toEqual(LeaseRenewalCreatedEventInput);
    });
  });
  describe('when building the input for a lease renewal quote print event', () => {
    it('should return an input object with the active lease data and printed quote data', () => {
      const input = dsInputBuilder.build(ctx, LeaseRenewalQuotePrintEvent);
      expect(input).toEqual(LeaseRenewalQuotePrintInput);
    });
  });
});
