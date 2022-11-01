/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLayoutsToExport } from '../../../dal/layoutRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

/* use DB_MAPPER just if the columnHeader from workbooksheet is different to the field in the DB */
const DB_MAPPERS = [
  {
    columnHeader: 'inactiveFlag',
    dbField: 'inactive',
  },
];

export const exportLayouts = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.Layout;
  const columnHeaders = getColumnHeaders(spreadsheet.Layout.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const layouts = await getLayoutsToExport(ctx, dbSimpleFields, propertyIdsToExport);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(layouts, columnHeadersOrderedMapped);
};
