/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import groupBy from 'lodash/groupBy';
import { formatDateForConfirmLease, getFeeEntry, FeeType, getConcessionEndDate } from './utils';
import { DALTypes } from '../../../../common/enums/DALTypes';

const getNonRecurringConcessions = (items, leaseStartDate, property) => {
  const charges = [];

  const nonRecurringItems = items.filter(i => i.type !== FeeType.Recurring);
  const amount = nonRecurringItems.length ? nonRecurringItems.reduce((sum, item) => sum + parseFloat(item.amount), 0) : 0;
  charges.push({ ...items[0], type: FeeType.Recurring, amount, concessionEndDate: `'${getConcessionEndDate(leaseStartDate, property.timezone)}'` });

  Object.values(FeeType).forEach(type => {
    if (type === FeeType.Recurring) return;

    charges.push({
      ...items[0],
      type,
      amount: 0,
    });
  });

  return charges;
};

export const createConfirmLeaseMapper = data => {
  const { allAvailableCharges, externalInfo, appFeeAmount, securityDepositCharge, property, lease } = data;
  const { leaseEndDate, leaseStartDate } = lease.baselineData.publishedLease || {};

  if (!externalInfo.externalId) return {};

  const initialCharges = allAvailableCharges
    .filter(x => !!x.externalChargeCode)
    .map(fee => getFeeEntry(fee))
    .filter(x => x);
  initialCharges.push({
    amount: appFeeAmount || 0,
    externalChargeCode: "'APP'",
    type: FeeType.NonRefundable,
  });

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

  const byChargeCode = groupBy(initialCharges, 'externalChargeCode');
  const charges = [];

  const unsupportedConcessions = initialCharges.filter(
    c => c.isConcession && c.type !== FeeType.Recurring && c.nonRecurringAppliedAt === DALTypes.NonRecurringApplied.FIRST_FULL,
  );

  if (unsupportedConcessions?.length) {
    throw new Error(`Unsupported first full concessions: ${unsupportedConcessions.map(c => c.externalChargeCode)}`);
  }

  Object.keys(byChargeCode).forEach(chargeCode => {
    const items = byChargeCode[chargeCode];
    const isNonRecurringConcession = items[0].isConcession && !items.map(i => i.type).includes(FeeType.Recurring);

    if (isNonRecurringConcession) {
      const nonRecurringConcessions = getNonRecurringConcessions(items, leaseStartDate, property);
      nonRecurringConcessions.map(c => charges.push(c));
      return;
    }

    Object.values(FeeType).forEach(type => {
      const itemsByFeeType = items.filter(i => i.type === type);
      charges.push({
        ...items[0],
        type,
        amount: itemsByFeeType.length ? itemsByFeeType.reduce((sum, item) => sum + parseFloat(item.amount), 0) : 0,
      });
    });
  });

  return {
    nameID: externalInfo.externalId,
    leaseEndDate: formatDateForConfirmLease(leaseEndDate, property.timezone),
    charges,
  };
};
