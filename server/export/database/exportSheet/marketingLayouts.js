/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getMarketingLayoutsToExport } from '../../../dal/marketingLayoutsRepo';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';
import { getSimpleFieldsColumns, buildDataPumpFormat, getColumnHeadersMappedWithDB } from '../../helpers/export';

const DB_MAPPERS = [
  {
    columnHeader: 'inactiveFlag',
    dbField: 'inactive',
  },
];

export const exportMarketingLayouts = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.MarketingLayouts;
  const columnHeaders = getColumnHeaders(spreadsheet.MarketingLayouts.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const marketingLayouts = await getMarketingLayoutsToExport(ctx, dbSimpleFields, propertyIdsToExport);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(marketingLayouts, columnHeadersOrderedMapped);
};
