/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getOccupyDate } from '../../common-export-utils';
import { mapDataToFields, formatUSDate } from './utils';

const fields = {
  ProspectID: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
  EstimatedMoveInDate: {
    fn: ({ lease, quote, party, property, inventoryAvailabilityDate }) =>
      formatUSDate(getOccupyDate({ lease, quote, inventoryAvailabilityDate, party, propertyTimezone: property.timezone }), property.timezone),
    isMandatory: true,
  },
};

export const createAcceptLeaseMapper = data => mapDataToFields(data, fields);
