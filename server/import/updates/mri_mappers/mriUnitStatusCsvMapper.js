/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { converter } from '../../converters/mappers/converter';
import { DALTypes } from '../../../../common/enums/DALTypes';

const SKIP_VALUES = ['PropertyID'];
const isValid = row => !SKIP_VALUES.includes(row.PropertyID) && !!row.PropertyID && !!row.Building && !!row.UnitID;

const MRI_STATUS = {
  // Available
  A: DALTypes.InventoryState.VACANT_READY,
  // Notice Available
  B: DALTypes.InventoryState.OCCUPIED_NOTICE,
  // Vacant Ready
  C: DALTypes.InventoryState.VACANT_READY_RESERVED,
  // Employee Unit
  E: DALTypes.InventoryState.OCCUPIED,
  // Model
  M: DALTypes.InventoryState.MODEL,
  // Notice Rented
  N: DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED,
  // Occupied
  O: DALTypes.InventoryState.OCCUPIED,
  // Rental Office
  R: DALTypes.InventoryState.ADMIN,
  // Unrentable (rentable items only)
  U: DALTypes.InventoryState.DOWN,
  // Construction
  W: DALTypes.InventoryState.DOWN,
  // Exercise Room
  X: DALTypes.InventoryState.ADMIN,
};

export const CSV_HEADERS = [
  'PropertyID',
  'Building',
  'UnitID',
  'ClassID',
  'Style',
  'SqFt',
  'Floorplan',
  'UnitStatus',
  'AvailableDate',
  'UnitIdentifier',
  'NameID',
];

export const NEW_CSV_HEADERS = ['state', 'availabilityDate', 'property', 'computedExternalId'];

const MAPPING = [
  { excel: 'state', fn: row => MRI_STATUS[row.UnitStatus] },
  { excel: 'availabilityDate', csv: 'AvailableDate' },
  { excel: 'property', csv: 'PropertyID' },
  { excel: 'computedExternalId', fn: row => [row.PropertyID, row.Building, row.UnitID].filter(x => x).join('-') },
];

export const REQUIRED_HEADERS = ['AvailableDate', 'UnitStatus', 'PropertyID', 'Building', 'UnitID'];

export const mriUnitStatusCsvMapper = row => ({
  valid: isValid(row),
  data: converter(row, NEW_CSV_HEADERS, MAPPING),
});
