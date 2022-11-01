/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { DALTypes } from '../../../common/enums/DALTypes';
import { shouldRecordCallForTeams } from '../helpers/telephonyHelpers';

describe('call recording team preference', () => {
  describe('given some teams involved in a call', () => {
    describe('when call is inbound', () => {
      it('call should NOT be recorded if no team has `INBOUND` or `INBOUND_AND_OUTBOUND` recording pref', () => {
        const teams = [
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.NO_RECORDING,
            },
          },
        ];

        expect(shouldRecordCallForTeams(DALTypes.CommunicationDirection.IN, teams)).to.not.be.ok;
      });

      it('call should be recorded if some teams have `INBOUND` recording pref', () => {
        const teams = [
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.INBOUND,
            },
          },
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.NO_RECORDING,
            },
          },
        ];

        expect(shouldRecordCallForTeams(DALTypes.CommunicationDirection.IN, teams)).to.be.ok;
      });

      it('call should be recorded if some teams have `INBOUND_AND_OUTBOUND` recording pref', () => {
        const teams = [
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.INBOUND_AND_OUTBOUND,
            },
          },
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.NO_RECORDING,
            },
          },
        ];

        expect(shouldRecordCallForTeams(DALTypes.CommunicationDirection.IN, teams)).to.be.ok;
      });
    });

    describe('when call is outbound', () => {
      it('call should NOT be recorded if no team has `OUTBOUND` or `INBOUND_AND_OUTBOUND` recording pref', () => {
        const teams = [
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.NO_RECORDING,
            },
          },
        ];

        expect(shouldRecordCallForTeams(DALTypes.CommunicationDirection.OUT, teams)).to.not.be.ok;
      });

      it('call should be recorded if some teams have `OUTBOUND` recording pref', () => {
        const teams = [
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.OUTBOUND,
            },
          },
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.NO_RECORDING,
            },
          },
        ];

        expect(shouldRecordCallForTeams(DALTypes.CommunicationDirection.OUT, teams)).to.be.ok;
      });

      it('call should be recorded if some teams have `INBOUND_AND_OUTBOUND` recording pref', () => {
        const teams = [
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.INBOUND_AND_OUTBOUND,
            },
          },
          {
            metadata: {
              callRecordingSetup: DALTypes.CallRecordingSetup.NO_RECORDING,
            },
          },
        ];

        expect(shouldRecordCallForTeams(DALTypes.CommunicationDirection.OUT, teams)).to.be.ok;
      });
    });
  });
});
