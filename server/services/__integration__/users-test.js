/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAUser, createAParty, createAPartyMember } from '../../testUtils/repoHelper';
import { findSupervisingUserByGuestPhoneNumber } from '../users';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { enhance } from '../../../common/helpers/contactInfoUtils';

describe('users services', () => {
  const ctx = { tenantId: tenant.id };

  describe(`given guest belonging to a party supervised by a user,
            when trying to find supervising user by guest phone number`, () => {
    it('the user is retrieved', async () => {
      const phoneNo = '14155552671';
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const contactInfo = enhance([
        { type: 'email', value: 'batman@gotham.com' },
        { type: 'phone', value: phoneNo },
      ]);
      await createAPartyMember(party.id, { fullName: 'Batman', contactInfo });

      const actualUser = await findSupervisingUserByGuestPhoneNumber(ctx, phoneNo);
      expect(actualUser).to.deep.equal(user);
    });
  });
});
