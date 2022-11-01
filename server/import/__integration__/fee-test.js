/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { testCtx as ctx, createAFee, createAProperty } from '../../testUtils/repoHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { deleteAndSaveAssociatedFees, getAssociatedFeesCycle } from '../inventory/fee';
import '../../testUtils/setupTestGlobalContext';

describe('inventory/fee', () => {
  let fee1;
  let fee2;
  let fee3;
  let fee4;
  let fee5;
  let property;

  beforeEach(async () => {
    property = await createAProperty({});
    fee1 = await createAFee({
      id: getUUID(),
      feeName: 'ApartmentTest',
      displayName: 'AptTest',
      feeType: DALTypes.FeeType.APPLICATION,
      propertyId: property.id,
    });
    fee2 = await createAFee({
      id: getUUID(),
      feeName: 'WaterTest',
      displayName: 'WaterTest',
      feeType: DALTypes.FeeType.APPLICATION,
      propertyId: property.id,
    });
    fee3 = await createAFee({
      id: getUUID(),
      feeName: 'GasTest',
      displayName: 'GasTest',
      feeType: DALTypes.FeeType.APPLICATION,
      propertyId: property.id,
    });
    fee4 = await createAFee({
      id: getUUID(),
      feeName: 'SewerTest',
      displayName: 'SewerTest',
      feeType: DALTypes.FeeType.APPLICATION,
      propertyId: property.id,
    });
    fee5 = await createAFee({
      id: getUUID(),
      feeName: 'ParentCycleTest',
      displayName: 'ParentCycleTest',
      feeType: DALTypes.FeeType.APPLICATION,
      propertyId: property.id,
    });

    fee1.validRelatedFees = [fee2.id];
    fee1.validAdditionalFees = [fee3.id];

    fee5.validRelatedFees = [fee5.id]; // Related to itself to test a parent cycle
    fee5.validAdditionalFees = [fee3.id];
    await deleteAndSaveAssociatedFees(ctx, [fee1, fee5]);
  });

  it('return false when it is looking for a cycle when inserting relations between fees', async () => {
    fee2.relatedFees = fee3.name;
    fee2.additionalFees = fee4.name;
    const fees = [];
    const cycleObj = await getAssociatedFeesCycle(ctx, fee2, fees.concat(fee2.relatedFees, fee2.additionalFees));
    expect(cycleObj.isThereACycle).to.equal(false);
  });

  it('return true when it is looking for a cycle when inserting relatedFees', async () => {
    fee2.relatedFees = fee1.name;
    fee2.additionalFees = '';
    const fees = [];
    const cycleObj = await getAssociatedFeesCycle(ctx, fee2, fees.concat(fee2.relatedFees, fee2.additionalFees));
    expect(cycleObj.isThereACycle).to.equal(true);
  });

  it('return true when it is looking for a cycle when inserting additionalFees', async () => {
    fee2.relatedFees = '';
    fee2.additionalFees = fee1.name;
    const fees = [];
    const cycleObj = await getAssociatedFeesCycle(ctx, fee2, fees.concat(fee2.relatedFees, fee2.additionalFees));
    expect(cycleObj.isThereACycle).to.equal(true);
  });

  it('return true when it is looking for a cycle in a parent related to itself when inserting additionalFees', async () => {
    fee3.relatedFees = '';
    fee3.additionalFees = '';
    const fees = [];
    const cycleObj = await getAssociatedFeesCycle(ctx, fee3, fees.concat(fee3.relatedFees, fee3.additionalFees));
    expect(cycleObj.isThereACycle).to.equal(true);
  });

  it('return true when it is looking for a cycle in a same tree of relations', async () => {
    fee2.validRelatedFees = [fee3.id];
    fee2.validAdditionalFees = [fee4.id];
    await deleteAndSaveAssociatedFees(ctx, [fee2]);

    fee4.relatedFees = fee1.name;
    fee4.additionalFees = '';
    const fees = [];
    const cycleObj = await getAssociatedFeesCycle(ctx, fee4, fees.concat(fee4.relatedFees, fee2.additionalFees));
    expect(cycleObj.isThereACycle).to.equal(true);
  });
});
