/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields, SECDEP_CHARGE_CODE, formatDateWithTimeZone } from './mapUtils';
import { getPropertyExternalId } from '../../common-export-utils';

const getChargeAmount = charge => {
  if (!charge.recurring || !charge.recurringCount) return charge.amount;

  return charge.amount / charge.recurringCount;
};

const resLeaseChargesFields = {
  Tenant_Code: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
  Ext_Ref_Tenant_Id: '',
  Charge_Code: {
    fn: ({ charge }) => charge.externalChargeCode,
    isMandatory: true,
  },
  From_Date: {
    fn: ({ charge, property }) => formatDateWithTimeZone(charge.fromDate, property.timezone),
  },
  To_Date: {
    fn: ({ charge, property }) => formatDateWithTimeZone(charge.toDate, property.timezone),
  },
  Amount: {
    fn: ({ charge }) => getChargeAmount(charge),
    isMandatory: true,
  },
  Property_Code: {
    fn: ({ inventory, property, propertyToExport }) => getPropertyExternalId({ inventory, property, propertyToExport }),
    isMandatory: true,
  },
};

export const createResLeaseChargesMapper = ({ charges, ...data }) =>
  charges
    .filter(charge => !charge.bakedIntoAppliedFeeFlag && charge.externalChargeCode !== SECDEP_CHARGE_CODE)
    .map(charge => mapDataToFields({ ...data, charge }, resLeaseChargesFields));
