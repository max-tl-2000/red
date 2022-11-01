/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { saveTeamData, getTeamBy } from '../teamsRepo';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { DALTypes } from '../../../common/enums/DALTypes';

const ctx = { tenantId: tenant.id };

describe('dal/teamsRepo', () => {
  const data = {
    name: 'A Team',
    displayName: 'A Team',
    description: 'A group of veterans...',
    module: 'leasing',
    directEmailIdentifier: 'a@team.com',
    directPhoneIdentifier: '12025550196',
    timeZone: 'America/Los_Angeles',
    inactiveFlag: false,
    properties: '',
    outsideDedicatedEmails: '',
  };

  describe('when saving a new team', () => {
    it('should save default settings', async () => {
      await saveTeamData(ctx, data);

      const team = await getTeamBy(ctx, { name: 'A Team' });

      const { endDate, metadata } = team;
      const { callRoutingStrategy, partyRoutingStrategy, callRecordingSetup } = metadata;

      expect(callRoutingStrategy).to.equal(DALTypes.CallRoutingStrategy.OWNER);
      expect(partyRoutingStrategy).to.equal(DALTypes.PartyRoutingStrategy.ROUND_ROBIN);
      expect(callRecordingSetup).to.equal(DALTypes.CallRecordingSetup.NO_RECORDING);
      expect(endDate).to.be.null;
    });

    describe('and it has a call center phone number', () => {
      it('saved call routing strategy should be "call center" and party routing strategy should be "dispatcher"', async () => {
        await saveTeamData(ctx, {
          ...data,
          callCenterPhoneNumber: '12025550197',
        });

        const team = await getTeamBy(ctx, { name: 'A Team' });

        const { endDate, metadata } = team;
        const { callRoutingStrategy, partyRoutingStrategy } = metadata;

        expect(callRoutingStrategy).to.equal(DALTypes.CallRoutingStrategy.CALL_CENTER);
        expect(partyRoutingStrategy).to.equal(DALTypes.PartyRoutingStrategy.DISPATCHER);
        expect(endDate).to.be.null;
      });
    });
  });

  describe('when updating a team', () => {
    it('should not overwrite exiting settings', async () => {
      const existingSettings = {
        callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY,
        partyRoutingStrategy: DALTypes.PartyRoutingStrategy.ROUND_ROBIN,
        callRecordingSetup: DALTypes.CallRecordingSetup.INBOUND_AND_OUTBOUND,
      };

      await saveTeamData(ctx, { ...data, metadata: existingSettings });

      await saveTeamData(ctx, data);

      const team = await getTeamBy(ctx, { name: 'A Team' });

      const { callRoutingStrategy, partyRoutingStrategy, callRecordingSetup } = team.metadata;

      expect(callRoutingStrategy).to.equal(existingSettings.callRoutingStrategy);
      expect(partyRoutingStrategy).to.equal(existingSettings.partyRoutingStrategy);
      expect(callRecordingSetup).to.equal(existingSettings.callRecordingSetup);
    });

    describe(' and the call center phone number is updated', () => {
      it('should update call routing strategy to "call center" and party routing strategy to "dispatcher"', async () => {
        const existingSettings = {
          callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY,
          partyRoutingStrategy: DALTypes.PartyRoutingStrategy.ROUND_ROBIN,
        };

        await saveTeamData(ctx, { ...data, metadata: existingSettings });

        await saveTeamData(ctx, {
          ...data,
          callCenterPhoneNumber: '12025550197',
        });

        const team = await getTeamBy(ctx, { name: 'A Team' });

        const { callRoutingStrategy, partyRoutingStrategy } = team.metadata;

        expect(callRoutingStrategy).to.equal(DALTypes.CallRoutingStrategy.CALL_CENTER);
        expect(partyRoutingStrategy).to.equal(DALTypes.PartyRoutingStrategy.DISPATCHER);
      });
    });
  });

  describe('when saving a new inactive team', () => {
    it('should save the endDate', async () => {
      await saveTeamData(ctx, { ...data, inactiveFlag: true });

      const team = await getTeamBy(ctx, { name: 'A Team' });

      const { endDate } = team;

      const validEndDate = !Number.isNaN(Date.parse(endDate));
      expect(validEndDate).to.be.true;
    });
  });

  describe('when updating a team with the inactive flag set to true', () => {
    it('should update endDate', async () => {
      await saveTeamData(ctx, data);

      await saveTeamData(ctx, { ...data, inactiveFlag: true });

      const team = await getTeamBy(ctx, { name: 'A Team' });

      const { endDate } = team;
      const validEndDate = !Number.isNaN(Date.parse(endDate));

      expect(validEndDate).to.be.true;
    });
  });

  describe('when updating a team with the inactive flag set to false', () => {
    it('should update endDate to null', async () => {
      await saveTeamData(ctx, { ...data, inactiveFlag: true });

      let team = await getTeamBy(ctx, { name: 'A Team' });

      const validEndDate = !Number.isNaN(Date.parse(team.endDate));
      expect(validEndDate).to.be.true;

      await saveTeamData(ctx, { ...data, inactiveFlag: false });

      team = await getTeamBy(ctx, { name: 'A Team' });

      const { endDate } = team;
      expect(endDate).to.be.null;
    });
  });
});
