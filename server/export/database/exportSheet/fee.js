/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getFeesToExport } from '../../../dal/feeRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

const DB_MAPPERS = [
  {
    columnHeader: 'variableAdjustmentFlag',
    dbField: 'variableAdjustment',
  },
  {
    columnHeader: 'estimatedFlag',
    dbField: 'estimated',
  },
  {
    columnHeader: 'depositInterestFlag',
    dbField: 'depositInterest',
  },
];

export const exportFees = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.Fee;
  const columnHeaders = getColumnHeaders(spreadsheet.Fee.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const fees = await getFeesToExport(ctx, dbSimpleFields, propertyIdsToExport);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(fees, columnHeadersOrderedMapped);
};
