/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import FakeDispatcher from '../fakeDispatcher.js';
import { DALTypes } from '../../../../common/enums/DALTypes';

const { PartyEventType } = DALTypes;
const fakeDispatcher = new FakeDispatcher();

describe('getDecisionServicesToCall()', () => {
  describe('when a comm event is passed', () => {
    it('should return a list of decision services for the comm event', () => {
      const decisionServices = fakeDispatcher.getDecisionServicesToCall({ event: PartyEventType.COMMUNICATION_COMPLETED });
      expect(decisionServices).toEqual(expect.arrayContaining(fakeDispatcher.commsDS));
    });
  });
  describe('when a task event is passed', () => {
    it('should return a list of decision services for the task event', () => {
      const decisionServices = fakeDispatcher.getDecisionServicesToCall({ event: PartyEventType.TASK_ADDED });
      expect(decisionServices).toEqual(expect.arrayContaining(fakeDispatcher.taskDS));
    });
  });
  describe('when a custom message event is passed', () => {
    it('should return a list of decision services for the custom message event', () => {
      const decisionServices = fakeDispatcher.getDecisionServicesToCall({ event: PartyEventType.CUSTOM_MESSAGE });
      expect(decisionServices).toEqual(expect.arrayContaining(fakeDispatcher.customEventDS));
    });
  });
  describe('when an unsupported event is passed', () => {
    it('should return an empty list of decision services', () => {
      const decisionServices = fakeDispatcher.getDecisionServicesToCall({ event: PartyEventType.PARTY_UPDATED });
      expect(decisionServices).toEqual(expect.arrayContaining([]));
    });
  });
});
