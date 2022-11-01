/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const isMatchingFee = (validFeeFromSheet, feeSaved) => feeSaved.name === validFeeFromSheet.name && feeSaved.propertyId === validFeeFromSheet.propertyId;

export const feesSavedWithAdditionalAndRelatedFees = (validFeesFromSheet, feesSaved) =>
  feesSaved.map(fee => {
    const { data, index } = validFeesFromSheet.find(({ data: validFeeFromSheet }) => isMatchingFee(validFeeFromSheet, fee));
    return {
      index,
      data: {
        id: fee.id,
        ...data,
      },
    };
  });
