/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment } from '../../../../common/helpers/moment-utils';
import { mapDataToFields, getUnitCode, formatDateWithTimeZone } from './mapUtils';
import { getPropertyExternalId } from '../../common-export-utils';

const getPostMonth = ({ postMonth, finChargeDate, timezone }) => {
  let date;
  if (postMonth) {
    // when the datetime is in ISO format the following comparison can be safely done without taking into consideration the timezone
    date = toMoment(finChargeDate) < toMoment(postMonth) ? postMonth : finChargeDate;
  } else {
    date = finChargeDate;
  }

  return toMoment(date, { timezone }).startOf('month').format('M/D/YYYY');
};

const getChargeDate = (finCharge, property) => formatDateWithTimeZone(finCharge.date, property.timezone);

const finChargesFields = {
  PROPERTY: {
    fn: ({ inventory, property, propertyToExport }) => getPropertyExternalId({ inventory, property, propertyToExport }),
    isMandatory: true,
  },
  PERSON: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
  OFFSET: {
    fn: ({ finCharge }) => finCharge.offset,
    isMandatory: false,
  },
  AMOUNT: {
    fn: ({ finCharge }) => Number(finCharge.amount).toFixed(2),
    isMandatory: true,
  },
  DATE: {
    fn: ({ finCharge, property }) => getChargeDate(finCharge, property),
    isMandatory: true,
  },
  POSTMONTH: {
    fn: ({ finCharge, property: { postMonth, timezone } }) => getPostMonth({ postMonth, finChargeDate: finCharge.date, timezone }),
    isMandatory: true,
  },
  ACCOUNT: {
    fn: ({ finCharge }) => finCharge.account,
    isMandatory: false,
  },
  ACCRUAL: {
    fn: ({ finCharge }) => finCharge.accrual,
    isMandatory: false,
  },
  NOTES: {
    fn: ({ finCharge }) => finCharge.notes,
    isMandatory: false,
  },
  REF: {
    fn: ({ finCharge }) => finCharge.ref,
    isMandatory: false,
  },
  UNIT: {
    fn: ({ inventory }) => getUnitCode(inventory),
    isMandatory: true,
  },
};

export const createFinChargesMapper = data => {
  const { finCharges } = data;
  return finCharges.map(finCharge => mapDataToFields({ ...data, finCharge }, finChargesFields));
};
