/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const importSkipReasons = {
  NO_LEASE_TERM: 'No lease term specified for the lease',
  MISSING_UNIT: 'Unit does not exist',
  NEW_RECORD_EXISTS: 'New record exists for this entry',
  ACTIVE_LEASE_ENDED: 'The active lease workflow was closed or archived',
  MOVED_OUT: 'The leaseholders have moved out',
  ACTIVE_LEASE_ON_SAME_UNIT: 'Another active lease already exists for this unit',
};
