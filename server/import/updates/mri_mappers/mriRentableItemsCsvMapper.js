/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import { DALTypes } from '../../../../common/enums/DALTypes';

const REQUIRED_FIELDS = ['RMPROPID', 'RITEMID', 'RITYPEID', 'Status'];
const isValid = row => REQUIRED_FIELDS.every(field => row[field]);

const INVENTORY_STATE_MAP = {
  // Available
  A: DALTypes.InventoryState.VACANT_READY,
  // Notice Available
  B: DALTypes.InventoryState.OCCUPIED_NOTICE,
  // Vacant Ready
  C: DALTypes.InventoryState.VACANT_READY_RESERVED,
  // Notice Rented
  N: DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
  // Occupied
  O: DALTypes.InventoryState.OCCUPIED,
  // Unrentable (rentable items only)
  U: DALTypes.InventoryState.DOWN,
};

export const CSV_HEADERS = ['DateAvailable', 'Status', 'ExternalId'];

export const NEW_CSV_HEADERS = ['stateStartDate', 'state', 'externalId'];

const MAPPING = [
  { excel: 'stateStartDate', csv: 'DateAvailable' },
  { excel: 'state', fn: row => INVENTORY_STATE_MAP[row.Status] },
  { excel: 'externalId', csv: 'ExternalId' },
];

export const REQUIRED_HEADERS = ['ExternalId', 'Status'];

export const mriRentableItemsCsvMapper = row => ({
  valid: isValid(row),
  data: converter(row, NEW_CSV_HEADERS, MAPPING),
});
