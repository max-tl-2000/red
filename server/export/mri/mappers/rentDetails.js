/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields } from './utils';

const fields = {
  Rent: {
    fn: ({ lease }) => lease.baselineData.publishedLease.unitRent,
    isMandatory: true,
  },
  // Concessions are already applied to the rent amount.
  Concession: 0,
};

export const createRentDetailsMapper = data => [mapDataToFields(data, fields)];
