/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAParty, createAPartyMember, testCtx } from '../../testUtils/repoHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { setPrimaryTenant } from '../export';
import { loadParty } from '../../dal/partyRepo';
import { getPrimaryExternalInfoByParty } from '../../dal/exportRepo';

describe('when exporting a party', () => {
  const ctx = { tenantId: tenant.id };

  describe('when setPrimaryTenant is called', () => {
    describe('for a party without an active member which has a pCode from Yardi', () => {
      it('should assign a new one to a party member', async () => {
        const party = await createAParty({}, testCtx, { createAssignedProperty: true });
        await createAPartyMember(party.id);
        await createAPartyMember(party.id, { memberType: DALTypes.MemberType.RESIDENT });
        const partyFromDb = await loadParty(ctx, party.id);

        await setPrimaryTenant(ctx, { partyId: party.id, partyMembers: partyFromDb.partyMembers, propertyId: party.assignedPropertyId });

        const externalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);
        expect(externalInfo).to.be.ok;
        expect(externalInfo.externalProspectId).to.be.ok;
      });
    });
  });
});
