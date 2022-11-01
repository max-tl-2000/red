/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields, formatDateForMRI } from './utils';
import { getOccupyDate } from '../../common-export-utils';

const fields = {
  ProspectID: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
  PropertyID: {
    fn: ({ inventory }) => inventory.property.externalId,
    isMandatory: true,
  },
  BuildingID: {
    fn: ({ inventory }) => inventory.building.externalId,
  },
  UnitID: {
    fn: ({ inventory }) => inventory.externalId,
  },
  LeaseTerm: {
    fn: ({ leaseTermLength }) => leaseTermLength,
  },
  OccupyDate: {
    fn: ({ lease, quote, party, property, inventoryAvailabilityDate }) =>
      formatDateForMRI(getOccupyDate({ lease, quote, inventoryAvailabilityDate, party, propertyTimezone: property.timezone }), property.timezone),
    isMandatory: true,
  },
};

export const createSelectUnitMapper = data => [mapDataToFields(data, fields)];
