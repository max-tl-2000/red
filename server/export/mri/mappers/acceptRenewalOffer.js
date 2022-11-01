/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { formatDateForConfirmLease } from './utils';

export const createAcceptRenewalOfferMapper = data => {
  const { externalInfo, property, lease, leaseTermLength, userExternalUniqueId } = data;

  if (!externalInfo.externalId) return {};

  return {
    nameID: externalInfo.externalId,
    termLength: leaseTermLength,
    leaseExpireDate: formatDateForConfirmLease(lease.baselineData.publishedLease.leaseEndDate, property.timezone),
    userExternalUniqueId,
  };
};
