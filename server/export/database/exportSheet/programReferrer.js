/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getProgramReferrersToExport } from '../../../dal/programsRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

const DB_MAPPERS = [
  {
    columnHeader: 'defaultFlag',
    dbField: 'isDefault',
  },
  {
    columnHeader: 'inactiveFlag',
    dbField: 'inactive',
  },
];

export const exportProgramReferrers = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.ProgramReferrer;
  const columnHeaders = getColumnHeaders(spreadsheet.ProgramReferrer.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const programReferrers = await getProgramReferrersToExport(ctx, dbSimpleFields);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(programReferrers, columnHeadersOrderedMapped);
};
