/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { toMoment } from '../../../common/helpers/moment-utils';
import { getFeeById, getFeesByFilter } from '../../services/fees';
import { getConcessionById } from '../../services/concessions';
import { SECDEP_CHARGE_CODE } from './mappers/mapUtils';
import { getChargeExternalData } from './helpers';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

const getFee = async (ctx, chargeId) => {
  const [feedId1, feedId2] = chargeId.split('--');
  let fee = await getFeeById(ctx, feedId1);
  if (!fee) {
    fee = await getFeeById(ctx, feedId2);
  }

  return fee;
};

const addMonths = (date, months, timezone) => toMoment(date, { timezone }).add(months, 'months');

const getOneTimeCharges = async (ctx, charges, lease) => {
  logger.trace({ ctx, charges, leaseId: lease.id }, 'getOneTimeCharges');

  const { baselineData: { timezone } = {} } = lease;
  const result = await mapSeries(Object.keys(charges), async chargeId => {
    const fee = await getFee(ctx, chargeId);
    if (!fee) return null;

    const { leaseStartDate } = lease.baselineData.publishedLease;

    return {
      id: fee.id,
      amount: charges[chargeId].amount,
      externalChargeCode: fee.externalChargeCode,
      fromDate: leaseStartDate,
      toDate: addMonths(leaseStartDate, 1, timezone),
    };
  });

  return result.filter(oneTimeCharge => oneTimeCharge).sort((a, b) => a.amount - b.amount);
};

const getConcessions = async (ctx, concessions, lease, isChargeConcessions) => {
  logger.trace({ ctx, concessions, leaseId: lease.id, isChargeConcessions }, 'getConcessions');

  const { baselineData: { timezone } = {} } = lease;
  const result = await mapSeries(Object.keys(concessions), async concessionId => {
    const concession = await getConcessionById(ctx, concessionId);
    const { recurring, recurringCount } = concession;

    const { leaseStartDate } = lease.baselineData.publishedLease;

    // subtract 1 day for the 1-month concessions
    const months = recurring ? recurringCount : 1;
    let toDate = addMonths(leaseStartDate, months, timezone);
    toDate = months === 1 ? toDate.subtract(1, 'days') : toDate;

    // Because in baselineData we store concessions one way, and concessions on additionalCharges another way.
    const amount = isChargeConcessions ? concessions[concessionId] : concessions[concessionId].amount;
    return {
      id: concessionId,
      amount: -1 * Math.abs(amount),
      externalChargeCode: concession.externalChargeCode,
      bakedIntoAppliedFeeFlag: concession.bakedIntoAppliedFeeFlag,
      recurring,
      recurringCount,
      fromDate: leaseStartDate,
      toDate: toDate.toISOString(),
    };
  });

  return result.sort((a, b) => a.recurringCount - b.recurringCount);
};

const getAdditionalCharges = async (ctx, charges, lease) => {
  logger.trace({ ctx, charges, leaseId: lease.id }, 'getAdditionalCharges');

  const result = await Promise.all(
    Object.keys(charges).map(async chargeId => {
      const charge = charges[chargeId];
      const fee = await getFee(ctx, chargeId);

      const { leaseStartDate } = lease.baselineData.publishedLease;

      return {
        id: fee.id,
        amount: charge.amount,
        externalChargeCode: fee.externalChargeCode,
        fromDate: leaseStartDate,
      };
    }),
  );

  return result.sort((a, b) => a.amount - b.amount);
};

const getChargeConcessions = async (ctx, additionalCharges, lease) => {
  logger.trace({ ctx, additionalCharges, leaseId: lease.id }, 'getChargeConcessions');

  const result = await Promise.all(
    Object.keys(additionalCharges).map(async chargeId => {
      const concessions = additionalCharges[chargeId].concessions;
      if (!concessions) return null;

      return await getConcessions(ctx, concessions, lease, true);
    }),
  );

  return result.filter(x => x);
};

export const getCharges = async (ctx, lease) => {
  logger.trace({ ctx, leaseId: lease.id }, 'getCharges');

  const { oneTimeCharges, additionalCharges, concessions } = lease.baselineData.publishedLease;
  const chargeConcessions = await getChargeConcessions(ctx, additionalCharges, lease);
  const oneTimes = await getOneTimeCharges(ctx, oneTimeCharges, lease);
  const oneTimesIds = oneTimes.reduce((acc, f) => acc.concat(f.id), []);
  const fees = await getFeesByFilter(ctx, query => query.whereIn('id', oneTimesIds));

  const exportableFinCharges = oneTimes.filter(charge => charge.externalChargeCode === SECDEP_CHARGE_CODE && charge.amount > 0);
  const finCharges = await mapSeries(exportableFinCharges, async charge => ({
    isLeaseCharge: true,
    amount: charge.amount,
    date: lease.baselineData.publishedLease.leaseStartDate,
    ...(await getChargeExternalData(ctx, charge.id, fees)),
  }));

  return {
    finCharges,
    leaseCharges: [
      ...oneTimes.filter(charge => charge.externalChargeCode !== SECDEP_CHARGE_CODE),
      ...(await getAdditionalCharges(ctx, additionalCharges, lease)),
      ...(await getConcessions(ctx, concessions, lease)),
      ...[].concat(...chargeConcessions),
    ],
  };
};
