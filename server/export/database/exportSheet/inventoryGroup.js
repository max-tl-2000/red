/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getInventoryGroupsToExport } from '../../../dal/inventoryGroupRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

/* use DB_MAPPER just if the columnHeader from workbooksheet is different to the field in the DB */
const DB_MAPPERS = [
  {
    columnHeader: 'primaryRentableFlag',
    dbField: 'primaryRentable',
  },
  {
    columnHeader: 'rentControlFlag',
    dbField: 'rentControl',
  },
  {
    columnHeader: 'affordableFlag',
    dbField: 'affordable',
  },
  {
    columnHeader: 'inactiveFlag',
    dbField: 'inactive',
  },
];

export const exportInventoryGroups = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.InventoryGroup;
  const columnHeaders = getColumnHeaders(spreadsheet.InventoryGroup.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const inventoryGroups = await getInventoryGroupsToExport(ctx, dbSimpleFields, propertyIdsToExport);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(inventoryGroups, columnHeadersOrderedMapped);
};
