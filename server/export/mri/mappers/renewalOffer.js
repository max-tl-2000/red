/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import groupBy from 'lodash/groupBy';
import { formatDateForConfirmLease, getFeeEntry, FeeType } from './utils';

export const createRenewalOfferMapper = data => {
  const { allAvailableCharges, externalInfo, securityDepositCharge, property, lease, leaseTermLength } = data;

  if (!externalInfo.externalId) return {};

  const initialCharges = allAvailableCharges
    .filter(x => !!x.externalChargeCode)
    .map(fee => getFeeEntry(fee))
    .filter(x => x);

  initialCharges.push({
    amount: lease.baselineData.quote.unitRent,
    externalChargeCode: "'RNT'",
    type: FeeType.Recurring,
  });

  initialCharges.push({
    amount: securityDepositCharge,
    externalChargeCode: "'RNT'",
    type: FeeType.Deposit,
  });

  const filteredCharges = initialCharges.filter(x => x.amount && (x.type === FeeType.Recurring || x.type === FeeType.Deposit));

  const byChargeCode = groupBy(filteredCharges, 'externalChargeCode');

  const charges = Object.entries(byChargeCode).map(([key, keyCharges]) => {
    const charge = { name: key };

    const amount = (keyCharges.find(c => c.type === FeeType.Recurring) || {}).amount;
    if (amount) charge.amount = `'${amount}'`;

    const deposit = (keyCharges.find(c => c.type === FeeType.Deposit) || {}).amount;
    if (deposit) charge.deposit = `'${deposit}'`;

    return charge;
  });

  return {
    nameID: externalInfo.externalId,
    leaseEndDate: formatDateForConfirmLease(lease.baselineData.publishedLease.leaseEndDate, property.timezone),
    termLength: leaseTermLength,
    leaseStartDate: formatDateForConfirmLease(lease.baselineData.publishedLease.leaseStartDate, property.timezone),
    leaseExpireDate: formatDateForConfirmLease(lease.baselineData.publishedLease.leaseEndDate, property.timezone),
    charges,
  };
};
