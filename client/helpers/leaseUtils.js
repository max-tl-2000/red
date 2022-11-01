/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const getLeaseFieldValue = (lease, fieldId) => {
  if (!lease || !fieldId) return undefined;
  const { leaseData } = lease;

  if (leaseData.globalFields && leaseData.globalFields[fieldId]) {
    const field = leaseData.globalFields[fieldId];
    return field && field.value;
  }

  const leaseFields = Object.keys(leaseData.documents || {}).reduce((accFields, key) => {
    const { fields } = leaseData.documents[key];
    Object.keys(fields || {}).reduce((allFields, field) => {
      allFields[field] = fields[field];
      return allFields;
    }, accFields);
    return accFields;
  }, {});

  return leaseFields[fieldId] && leaseFields[fieldId].value;
};

export const isInventoryGroupFee = fee => !!fee.minRent && !!fee.maxRent;

export const canHaveRentableItems = fee => {
  if (!fee) return false;

  return !fee.hasInventoryPool && isInventoryGroupFee(fee);
};

export const getAdditionalAndOneTimeFeesFromPublishTermPeriod = (additionalAndOneTimeCharges, period) =>
  additionalAndOneTimeCharges.find(periodType => periodType.name === period);
