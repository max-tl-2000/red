/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { SavingState } from '../SavingState';

describe('SavingState', () => {
  describe('the saving flag', () => {
    it('should be true if at least one queue has a running task', () => {
      const savingState = new SavingState();
      savingState.notifyStart({ id: '1', resource: 'post_/quote' });

      expect(savingState.saving).to.equal(true);
    });

    it('should be false if no queues are in use', () => {
      const savingState = new SavingState();
      savingState.notifyStart({ id: '1', resource: 'post_/quote' });
      savingState.notifyEnd({ id: '1', resource: 'post_/quote' });

      expect(savingState.saving).to.equal(false);
    });
  });

  describe('hasResource', () => {
    it('should return true if the resource is currently in the serviceCalls map', () => {
      const savingState = new SavingState();
      savingState.notifyStart({ id: '1', resource: 'post_/quote' });
      savingState.notifyStart({ id: '2', resource: 'post_/parties' });

      expect(savingState.saving).to.equal(true);

      expect(savingState.hasResource(/post_\/quote/)).to.equal(true);
    });

    it('should return false if the resource is not in the serviceCalls map', () => {
      const savingState = new SavingState();
      savingState.notifyStart({ id: '1', resource: 'post_/quote' });
      savingState.notifyStart({ id: '2', resource: 'post_/parties' });

      expect(savingState.saving).to.equal(true);
      expect(savingState.pendingCallsCount).to.equal(2);

      expect(savingState.hasResource(/post_\/quote2/)).to.equal(false);
    });
  });

  describe('hasResource - using a function for the matcher', () => {
    it('should return true if the resource is currently in the serviceCalls map', () => {
      const savingState = new SavingState();
      savingState.notifyStart({ id: '1', resource: 'post_/quote' });
      savingState.notifyStart({ id: '2', resource: 'post_/parties' });

      expect(savingState.saving).to.equal(true);

      expect(savingState.hasResource(req => req.resource.match(/post_\/quote/))).to.equal(true);
    });

    it('should return false if the resource is not in the serviceCalls map', () => {
      const savingState = new SavingState();
      savingState.notifyStart({ id: '1', resource: 'post_/quote' });
      savingState.notifyStart({ id: '2', resource: 'post_/parties' });

      expect(savingState.saving).to.equal(true);
      expect(savingState.pendingCallsCount).to.equal(2);

      expect(savingState.hasResource(req => req.resource.match(/post_\/quote2/))).to.equal(false);
    });
  });
});
