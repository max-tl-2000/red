/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment } from '../../../../common/helpers/moment-utils';
import { mapDataToFields, getUnitCode, formatDateWithTimeZone } from './mapUtils';
import { getPropertyExternalId } from '../../common-export-utils';

// TODO: ask Avantica: We do need to use the timezone if we use `.startOf` with day or month
const getPostMonth = (date, timezone) => formatDateWithTimeZone(toMoment(date, { timezone }).startOf('month'), timezone);

const finReceiptsFields = {
  PROPERTY: {
    fn: ({ inventory, property }) => getPropertyExternalId({ inventory, property }),
    isMandatory: true,
  },
  PERSON: {
    fn: ({ partyMember, externals }) => externals.find(e => e.partyMemberId === partyMember.id).externalId,
    isMandatory: true,
  },
  DATE: {
    fn: ({ finReceipt, property }) => formatDateWithTimeZone(finReceipt.date, property.timezone),
    isMandatory: true,
  },
  // postmonth field is not implemented yet
  POSTMONTH: {
    fn: ({ finReceipt, property: { postMonth } }) => getPostMonth(postMonth || finReceipt.date),
    isMandatory: true,
  },
  AMOUNT: {
    fn: ({ finReceipt }) => Number(finReceipt.amount).toFixed(2),
    isMandatory: false,
  },
  OFFSET: {
    fn: ({ finReceipt }) => finReceipt.offset,
    isMandatory: false,
  },
  NOTES: {
    fn: ({ finReceipt }) => finReceipt.notes,
    isMandatory: false,
  },
  REF: {
    fn: ({ finReceipt }) => finReceipt.ref,
  },
  UNIT: {
    fn: ({ inventory }) => getUnitCode(inventory),
    isMandatory: true,
  },
  ACCOUNT: {
    fn: ({ finReceipt }) => finReceipt.account,
    isMandatory: false,
  },
  ACCRUAL: {
    fn: ({ finReceipt }) => finReceipt.accrual,
    isMandatory: false,
  },
};

export const createFinReceiptsMapper = data => {
  const { finReceipts } = data;

  return finReceipts.map(finReceipt => mapDataToFields({ ...data, finReceipt }, finReceiptsFields));
};
