/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields } from './utils';

const fields = {
  ProspectID: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
  },
  Quantity: {
    fn: ({ rentable }) => rentable.quantity,
    isMandatory: true,
  },
  ItemType: {
    fn: ({ rentable }) => rentable.externalId,
  },
  FeeType: {
    fn: ({ rentable }) => rentable.externalChargeCode,
  },
};

export const createRentableItemsAndFeesMapper = data => mapDataToFields(data, fields);
