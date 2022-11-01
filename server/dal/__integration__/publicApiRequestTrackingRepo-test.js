/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import {
  savePublicApiRequestTracking,
  getPublicApiRequestTrackingByPartyId,
  getPublicApiRequestCountByChecksum,
  updatePublicApiRequestTrackingById,
  cleanupPublicApiRequestTracking,
} from '../publicApiRequestTrackingRepo';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { createAParty } from '../../testUtils/repoHelper';
import { getObjectHash, getStringHash } from '../../../common/server/hash-utils';
import { now, toMoment } from '../../../common/helpers/moment-utils';

const ctx = { tenantId: tenant.id };

describe('dal/publicApiRequestTrackingRepo', () => {
  let party;
  let part;
  const payload = { partyId: newId() };

  beforeEach(async () => {
    party = await createAParty();
    const documentVersion = newId();
    const sessionId = newId();
    const checksum = getObjectHash(payload);

    part = {
      partyId: party.id,
      documentVersion,
      sessionId,
      payload: JSON.stringify(payload),
      urlPath: '/some/url',
      checksum,
    };
  });

  describe('when saving a new public api response tracking', () => {
    it('should save and return the saved public api request tracking', async () => {
      const savedPart = await savePublicApiRequestTracking(ctx, part);
      const [partyPart] = await getPublicApiRequestTrackingByPartyId(ctx, party.id);

      expect(savedPart.partyId).to.equal(partyPart.partyId);
      expect(savedPart.documentVersion).to.equal(partyPart.documentVersion);
      expect(savedPart.payload).to.equal(partyPart.payload);
      expect(savedPart.checksum).to.equal(partyPart.checksum);
      expect(savedPart.sessionId).to.equal(partyPart.sessionId);
      expect(savedPart.urlPath).to.equal(partyPart.urlPath);
    });
  });

  describe("when getting a party's public api request tracking data by checksum amount", () => {
    it('should return the party public api request tracking data count with the same checksum', async () => {
      const checksum = getObjectHash(payload);
      await savePublicApiRequestTracking(ctx, part);
      await savePublicApiRequestTracking(ctx, { ...part, documentVersion: newId() });

      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum)).to.equal(2);
      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, getStringHash('non existing checksum'))).to.equal(0);
      expect(await getPublicApiRequestCountByChecksum(ctx, newId(), checksum)).to.equal(0);

      const newUrl = '/another/url';
      const newSessionId = newId();
      await savePublicApiRequestTracking(ctx, { ...part, documentVersion: newId() });
      await savePublicApiRequestTracking(ctx, { ...part, documentVersion: newId(), urlPath: newUrl, sessionId: newSessionId });

      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum)).to.equal(4);
      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { urlFilter: part.urlPath })).to.equal(3);
      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { urlFilter: newUrl })).to.equal(1);

      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { urlFilter: newUrl, sessionIdFilter: newSessionId })).to.equal(1);
      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { urlFilter: newUrl, sessionIdFilter: part.sessionId })).to.equal(0);

      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { sessionIdFilter: part.sessionId })).to.equal(3);
      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { sessionIdFilter: newSessionId })).to.equal(1);
    });

    it('should return the party public api request count with the same checksum within a given time frame', async () => {
      const checksum = getObjectHash(payload);
      const partOriginal = await savePublicApiRequestTracking(ctx, part);
      const partDuplicate = await savePublicApiRequestTracking(ctx, { ...part, documentVersion: newId() });
      const partDuplicate2 = await savePublicApiRequestTracking(ctx, { ...part, documentVersion: newId() });

      await updatePublicApiRequestTrackingById(ctx, partDuplicate.id, { created_at: toMoment(new Date()).add(-10, 'minutes').toJSON() });
      await updatePublicApiRequestTrackingById(ctx, partDuplicate2.id, { created_at: toMoment(new Date()).add(-12, 'minutes').toJSON() });

      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { minAgeFilter: '5 mins' })).to.equal(1);
      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { minAgeFilter: '15 mins' })).to.equal(3);

      await updatePublicApiRequestTrackingById(ctx, partOriginal.id, { created_at: toMoment(new Date()).add(-5, 'minutes').toJSON() });

      expect(await getPublicApiRequestCountByChecksum(ctx, party.id, checksum, { minAgeFilter: '2 mins' })).to.equal(0);
    });
  });

  describe('when cleaning the public api request tracking data', () => {
    it('should delete all request data older then daysToKeep', async () => {
      const publicApiRequestTracking = await Promise.all([
        savePublicApiRequestTracking(ctx, part),
        savePublicApiRequestTracking(ctx, part),
        savePublicApiRequestTracking(ctx, part),
        savePublicApiRequestTracking(ctx, part),
        savePublicApiRequestTracking(ctx, part),
      ]);

      const today = now().startOf('day');
      const yesterday = today.clone().add(-1, 'day');
      const dayBeforeYesterday = today.clone().add(-2, 'day');

      await Promise.all([
        updatePublicApiRequestTrackingById(ctx, publicApiRequestTracking[0].id, {
          created_at: today.clone().add(-49, 'hours').toJSON(),
        }),
        updatePublicApiRequestTrackingById(ctx, publicApiRequestTracking[1].id, {
          created_at: today.clone().add(-26, 'hours').toJSON(),
        }),
        updatePublicApiRequestTrackingById(ctx, publicApiRequestTracking[2].id, {
          created_at: today.clone().add(-23, 'hours').toJSON(),
        }),
      ]);

      let daysToKeep = 2;
      await cleanupPublicApiRequestTracking(ctx, daysToKeep);

      let latestPartyPart = await getPublicApiRequestTrackingByPartyId(ctx, party.id);

      expect(latestPartyPart.length).to.equal(4);
      expect(latestPartyPart.every(lpart => toMoment(lpart.created_at).isAfter(dayBeforeYesterday))).to.be.true;

      daysToKeep = 1;
      await cleanupPublicApiRequestTracking(ctx, daysToKeep);

      latestPartyPart = await getPublicApiRequestTrackingByPartyId(ctx, party.id);

      expect(latestPartyPart.length).to.equal(3);
      expect(latestPartyPart.every(lpart => toMoment(lpart.created_at).isAfter(yesterday))).to.be.true;
    });
  });
});
