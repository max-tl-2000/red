/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import sortBy from 'lodash/sortBy';
import { createAParty, createAMRIExport } from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { toMoment } from '../../../common/helpers/moment-utils';
import { getMRIExportStats } from '../mri-export-repo';

const ctx = { tenantId: tenant.id };

const MoveInResponse = `
  <LeaseResult xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Charges />
    <RecurringCharges />
    <leaseNumber>0</leaseNumber>
    <Result>Movein already scheduled</Result>
  </LeaseResult>`;

const sortByPartyId = parties => sortBy(parties, 'partyId');

describe('dal/mri-export-repo - getMRIExportStats()', () => {
  let party1;
  let party2;
  let party3;

  const initializeMRIExportData = async parties => {
    const initialTime = 0;

    await Promise.all(
      [
        { partyId: parties[0], response: MoveInResponse, timeDelta: initialTime - 12 },
        { partyId: parties[1], response: MoveInResponse, timeDelta: initialTime - 14 },
        { partyId: parties[1], response: MoveInResponse, timeDelta: initialTime - 18 },
        { partyId: parties[2], response: MoveInResponse, timeDelta: initialTime - 20 },
        { partyId: parties[2], response: MoveInResponse, timeDelta: initialTime - 30 },
        { partyId: parties[0], response: 'test', timeDelta: initialTime - 1 },
        { partyId: parties[1], response: 'test', timeDelta: initialTime - 2 },
        { partyId: parties[2], response: 'test', timeDelta: initialTime - 3 },
      ].map(async ({ partyId, response, timeDelta, timeFrame = 'hours' }) => {
        const createdAt = toMoment(new Date()).add(timeDelta, timeFrame);
        const mriExportRow = {
          partyId,
          response,
          created_at: createdAt.toJSON(),
        };
        return await createAMRIExport({ ctx, ...mriExportRow });
      }),
    );
  };

  beforeEach(async () => {
    [party1, party2, party3] = await Promise.all([createAParty(), createAParty(), createAParty()]);
    await initializeMRIExportData([party1, party2, party3].map(pa => pa.id));
  });

  describe('given a request to get MRIExport stats', () => {
    it('should return the total MRI export stats in the last 24 hours', async () => {
      const MRIExportStats = {};
      MRIExportStats.moveinAlreadyScheduled = await getMRIExportStats(ctx, 'Movein already scheduled');

      const expectedMRIExportStats = {};
      expectedMRIExportStats.moveinAlreadyScheduled = [
        { partyId: party1.id, responsesMatched: 1 },
        { partyId: party2.id, responsesMatched: 2 },
        { partyId: party3.id, responsesMatched: 1 },
      ];

      expectedMRIExportStats.moveinAlreadyScheduled = sortByPartyId(expectedMRIExportStats.moveinAlreadyScheduled);

      expect(MRIExportStats.moveinAlreadyScheduled).to.have.deep.equals(expectedMRIExportStats.moveinAlreadyScheduled);
    });

    it('should return the total MRI export stats for a custom time frame', async () => {
      const MRIExportStats = {};
      MRIExportStats.moveinAlreadyScheduled = await getMRIExportStats(ctx, 'Movein already scheduled', '10 hours');
      expect(MRIExportStats.moveinAlreadyScheduled).to.deep.equal([]);
    });
  });
});
