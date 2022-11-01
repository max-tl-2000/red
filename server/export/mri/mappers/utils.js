/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment } from '../../../../common/helpers/moment-utils';
import { DATE_US_FORMAT, YEAR_MONTH_DAY_FORMAT, MRI_DATETIME_FORMAT } from '../../../../common/date-constants';
import { DALTypes } from '../../../../common/enums/DALTypes';
export { mapDataToFields } from '../../helpers';

export const MAX_LENGTH_FIRST_NAME = 15;
export const MAX_LENGTH_LAST_NAME = 19;
export const MAX_LENGTH_VEHICLE_MAKE = 15;
export const MAX_LENGTH_VEHICLE_MODEL = 15;
export const MAX_LENGTH_VEHICLE_COLOR = 14;
export const MAX_LENGTH_VEHICLE_LICENSE_PLATE = 15;
export const MAX_LENGTH_PET_NAME = 20;
export const DEFAULT_EXTERNAL_UNIQUE_ID = '@';

// 2002-10-15T00:00:00.0000000
export const formatDateForMRI = (date, timezone) => {
  if (!date) return '';

  return toMoment(date, { timezone }).format(MRI_DATETIME_FORMAT);
};

export const formatUSDate = (date, timezone) => {
  if (!date) return '';

  return toMoment(date, { timezone }).format(DATE_US_FORMAT);
};

export const formatDateForConfirmLease = (date, timezone) => {
  if (!date) return '';

  return toMoment(date, { timezone }).format(YEAR_MONTH_DAY_FORMAT);
};

export const FeeType = {
  NonRefundable: "'NONREFUNDABLE'",
  Recurring: "'RECURRING'",
  Deposit: "'DEPOSIT'",
};

const isRecurring = fee => {
  if (fee.feeType === DALTypes.FeeType.INVENTORY_GROUP) return true;
  if (fee.feeType === DALTypes.FeeType.SERVICE && fee.servicePeriod && fee.servicePeriod !== DALTypes.ServicePeriod.ONE_TIME) return true;
  if (fee.isConcession) return fee.recurring;

  // this should be removed in the next release. It will be left here only because there are leases that
  // are already published and we need to take those into account.
  const lowerCaseFeeName = fee.feeName?.toLowerCase();
  const recurringFees = [
    'petrent',
    'parkingbaserent',
    'undergroundparkingbaserent',
    'storage',
    'smallstorage',
    'mediumstorage',
    'largestorage',
    'bikestorage',
    'cagestorage',
    'skisnowboardstorage',
    'storagelockers',
    'garageparking',
  ];

  if (recurringFees.includes(lowerCaseFeeName)) return true;

  return false;
};

export const getFeeEntry = fee => {
  const exportableFees = [
    'additionalgarageparking',
    'adminfee',
    'attachedgarageparking',
    'bikestorage',
    'cagestorage',
    'carportparking',
    'coveredparking',
    'detachedgarageparking',
    'detachedparking',
    'doublegarageparking',
    'firstparking',
    'firstparkingspot',
    'firstundergroundparking',
    'floor4storage',
    'furnishingupcharge',
    'garagebayparking',
    'garagedoubleparking',
    'garageopenerparking',
    'garageparking',
    'garageparkingwithopener',
    'garagetuckunderparking',
    'guarantorappfee',
    'insidegarageparking',
    'largegarageparking',
    'largestorage',
    'mediumstorage',
    'outdoorparking',
    'outsidegarageparking',
    'parkingbaserent',
    'parkinglot',
    'petdeposit',
    'petdeposit2pets',
    'petdepositfor2pets',
    'petfee',
    'petfee2pets',
    'petfeecat',
    'petfeedog',
    'petrent',
    'petrent2pets',
    'petrentcat',
    'petrentdog',
    'petrentfor2pets',
    'privategarageparking',
    'reservedparking',
    'secondparkingspot',
    'sharedgarageparking',
    'singleappfee',
    'singlegarageparking',
    'skisnowboardstorage',
    'smallstorage',
    'storage',
    'storage0',
    'storage1',
    'storage2',
    'storage3',
    'storage4',
    'storage5',
    'storage6',
    'storage7',
    'storagecloset',
    'storagegarage',
    'storagelockers',
    'storagespace',
    'tandemgarageparking',
    'uncoveredparking',
    'undergroundparking',
    'undergroundparkingbaserent',
    'unreservedparking',
    'attachedparking',
  ];
  const lowerCaseFeeName = fee.feeName?.toLowerCase();

  if (!fee.isConcession && !exportableFees.includes(lowerCaseFeeName)) {
    // export only certain fees
    return null;
  }

  // this is an inventory (instead of a fee or concession)
  if (!fee.externalChargeCode) return null;

  const isRecurringFee = isRecurring(fee);
  let amount;
  if (fee.isConcession) {
    amount = isRecurringFee ? -fee.relativeAmount : -fee.amount;
  } else {
    amount = fee.amount;
  }

  let feeType = FeeType.NonRefundable;
  if (isRecurringFee) {
    feeType = FeeType.Recurring;
  } else if (fee.feeType === 'deposit') {
    feeType = FeeType.Deposit;
  }

  return {
    externalChargeCode: `'${fee.externalChargeCode}'`,
    amount: amount || 0,
    type: feeType,
    isConcession: !!fee.isConcession,
    nonRecurringAppliedAt: fee?.nonRecurringAppliedAt || '',
  };
};

export const getConcessionEndDate = (leaseStartDate, timezone) => toMoment(leaseStartDate, { timezone }).add(1, 'month').format(YEAR_MONTH_DAY_FORMAT);
