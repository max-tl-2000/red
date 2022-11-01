/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAUser, createAPartyMember, createAParty, testCtx as ctx, getTenant } from '../../testUtils/repoHelper';
import { getAPartyApplicationByPartyId } from '../../../rentapp/server/test-utils/repo-helper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { updatePartyGuarantorHolds, updateTenantIgnoreImportUpdateOptimizationUntilFlag } from '../settings';
import { updateTenant } from '../../services/tenantService';
import '../../testUtils/setupTestGlobalContext';
import { isDateAfterDate } from '../../../common/helpers/date-utils';
import { now } from '../../../common/helpers/moment-utils';

describe('When the residentOrPartyLevelGuarantor setting is updated', () => {
  let party;
  const partySettingsDiff = [{ path: ['traditional', 'residentOrPartyLevelGuarantor'] }];

  beforeEach(async () => {
    const { id } = await createAUser();
    party = await createAParty({ userId: id });
    await createAPartyMember(party.id);
    await createAPartyMember(party.id, { memberType: DALTypes.MemberType.GUARANTOR });
  });

  describe('And set to "resident"', () => {
    it('should set a guarantor link missing Hold', async () => {
      await updatePartyGuarantorHolds(ctx, partySettingsDiff);
      const partyApplication = await getAPartyApplicationByPartyId(party.id);
      expect(partyApplication.isHeld).to.equal(true);
    });
  });

  describe('And set to "party"', () => {
    it('should remove any guarantor link missing hold', async () => {
      await updateTenant(ctx.id, {
        partySettings: {
          traditional: {
            residentOrPartyLevelGuarantor: 'party',
          },
        },
      });
      await updatePartyGuarantorHolds(ctx, partySettingsDiff);
      const partyApplication = await getAPartyApplicationByPartyId(party.id);
      expect(partyApplication.isHeld).to.equal(false);
    });
  });
});

describe('When the inventoryAvailabilityDate setting is updated', () => {
  const propertySettingsDiff = [{ path: ['inventoryAvailabilityDate'] }];

  beforeEach(async () => {
    const { id } = await createAUser();
    await createAParty({ userId: id });
  });

  it('should update the tenant ignoreImportUpdateOptimizationUntil', async () => {
    await updateTenantIgnoreImportUpdateOptimizationUntilFlag(ctx, propertySettingsDiff);
    const {
      metadata: { ignoreImportUpdateOptimizationUntil },
    } = await getTenant();
    expect(isDateAfterDate(ignoreImportUpdateOptimizationUntil, now())).to.equal(true);
  });
});
