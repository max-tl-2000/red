/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { assert } from 'chai';
import { createAParty, createAPartyMember } from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { markMemberAsRemoved } from '../../dal/partyRepo';
import { existsPersonInParty } from '../party';

describe('When calling existsPersonInParty', () => {
  describe('for a person who was added to a party', () => {
    it('should return true', async () => {
      const party = await createAParty();
      const { personId } = await createAPartyMember(party.id);

      const result = await existsPersonInParty(tenant.id, party.id, personId);

      assert.isTrue(result);
    });
  });

  describe('for a person who was added, then removed from a party', () => {
    it('should return false', async () => {
      const party = await createAParty();
      const { id, personId } = await createAPartyMember(party.id);
      await markMemberAsRemoved({ tenantId: tenant.id }, id);

      const result = await existsPersonInParty(tenant.id, party.id, personId);

      assert.isFalse(result);
    });
  });

  describe('for a person who was added, removed, and added back to a party', () => {
    it('should return true', async () => {
      const party = await createAParty();
      const { id, personId } = await createAPartyMember(party.id);
      await createAPartyMember(party.id, { personId });
      await markMemberAsRemoved({ tenantId: tenant.id }, id);

      const result = await existsPersonInParty(tenant.id, party.id, personId);

      assert.isTrue(result);
    });
  });
});
