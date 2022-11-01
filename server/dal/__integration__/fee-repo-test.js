/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  testCtx as ctx,
  createAProperty,
  createAnInventory,
  createAFee,
  createAInventoryGroup,
  setAssociatedFees,
  createALeaseTerm,
} from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { extractFeeId } from '../../../common/helpers/quotes';

describe('FeeRepo', () => {
  describe('When calling getAdditionalOneTimeFeesByPeriod function', () => {
    describe('And the function gets called twice', () => {
      it('should respond with different fee ids when fee is primary', async () => {
        const { id: propertyId } = await createAProperty({});

        const primaryFee = await createAFee({
          propertyId,
          absolutePrice: 37,
          feeName: 'MainFee',
          externalChargeCode: 'ADM',
        });

        const relatedFee1 = await createAFee({
          propertyId,
          absolutePrice: 37,
          feeName: 'PetFee',
          externalChargeCode: 'ADM',
          servicePeriod: 'month',
          feeType: 'service',
          quoteSectionName: 'pet',
          maxQuantityInQuote: 4,
        });

        const relatedFee2 = await createAFee({
          propertyId,
          absolutePrice: 37,
          feeName: 'Storage11x9',
          externalChargeCode: 'ADM',
          servicePeriod: 'month',
          feeType: 'service',
          quoteSectionName: 'storage',
          maxQuantityInQuote: 4,
        });

        const relatedFee3 = await createAFee({
          propertyId,
          absolutePrice: 47,
          feeName: 'Storage11x11',
          externalChargeCode: 'ADM',
          servicePeriod: 'month',
          feeType: 'service',
          quoteSectionName: 'storage',
          maxQuantityInQuote: 4,
        });

        const relatedFee4 = await createAFee({
          propertyId,
          absolutePrice: 47,
          feeName: 'Storage11x14',
          externalChargeCode: 'ADM',
          servicePeriod: 'month',
          feeType: 'service',
          quoteSectionName: 'storage',
          maxQuantityInQuote: 4,
        });

        const relatedFee5 = await createAFee({
          propertyId,
          absolutePrice: 47,
          feeName: 'Storage11x15',
          externalChargeCode: 'ADM',
          servicePeriod: 'month',
          feeType: 'service',
          quoteSectionName: 'storage',
          maxQuantityInQuote: 4,
        });

        const leaseTerm = await createALeaseTerm({
          propertyId,
          termLength: 12,
        });

        await setAssociatedFees(primaryFee.id, relatedFee1.id);
        await setAssociatedFees(relatedFee1.id, relatedFee2.id);
        await setAssociatedFees(primaryFee.id, relatedFee3.id);
        await setAssociatedFees(relatedFee1.id, relatedFee3.id);
        await setAssociatedFees(relatedFee3.id, relatedFee4.id);
        await setAssociatedFees(relatedFee4.id, relatedFee5.id);

        const inventoryGroup = await createAInventoryGroup({
          propertyId,
          feeId: primaryFee.id,
          leaseNameId: leaseTerm.leaseNameId,
        });

        const { id: inventoryId } = await createAnInventory({
          name: 'test-name',
          description: 'test-description',
          propertyId,
          inventoryGroupId: inventoryGroup.id,
        });

        const params = { inventoryId, leaseTerms: [leaseTerm], propertyTimezone: 'America/Los_Angeles' };

        const feeRepo = require('../feeRepo'); // eslint-disable-line global-require
        const firstResult = await feeRepo.getAdditionalOneTimeFeesByPeriod(ctx, params);

        const associatedFees = await feeRepo.feeRepoUtils.getFilteredAssociatedFeesByInventoryIdAndFeeLeaseState(ctx, inventoryId, false);

        sinon.stub(feeRepo.feeRepoUtils, 'getFilteredAssociatedFeesByInventoryIdAndFeeLeaseState').callsFake(() => [associatedFees[1], associatedFees[0]]);

        const secondResult = await feeRepo.getAdditionalOneTimeFeesByPeriod(ctx, params);

        const firstResultFeeIds = firstResult[0].fees.map(({ id }) => id);
        const secondResultFeeIds = secondResult[0].fees.map(({ id }) => id);

        expect(firstResultFeeIds.every(x => secondResultFeeIds.includes(x))).to.equal(false);

        const firstResultFormattedFeeIds = firstResult[0].fees.map(fee => extractFeeId(fee));
        const secondResultFormattedFeeIds = secondResult[0].fees.map(fee => extractFeeId(fee));

        expect(firstResultFormattedFeeIds.every(x => secondResultFormattedFeeIds.includes(x))).to.equal(true);
      });
    });
  });
});
