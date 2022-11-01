/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import { createAFee } from './repoHelper';

export const createTestFees = async (howMany, prefix, propertyId) => {
  const result = [];
  const start = 'A'.charCodeAt(0);
  for (let i = start; i < start + howMany; i++) {
    const feeName = `${prefix}-${String.fromCharCode(i)}`;
    result.push(
      await createAFee({
        propertyId,
        absolutePrice: i,
        feeName,
        displayName: feeName,
        externalChargeCode: `chargeCode-${feeName}`,
      }),
    );
  }

  return result;
};

export const createSecurityDeposit = async propertyId => {
  const result = await createAFee({
    propertyId,
    absolutePrice: 1000,
    feeName: 'UnitDeposit',
    displayName: 'Security deposit on unit',
    externalChargeCode: 'secdep',
    feeType: DALTypes.FeeType.DEPOSIT,
    quoteSectionName: DALTypes.QuoteSection.DEPOSIT,
    firstFee: true,
    externalChargeAccount: '24000',
    externalChargeAccrualAccount: '12000',
    externalChargeNotes: 'Security Deposit',
    externalChargeRef: ':MoveIn',
  });
  return result;
};
