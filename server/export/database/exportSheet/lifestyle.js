/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLifestylesToExport } from '../../../dal/amenityRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

const DB_MAPPERS = [
  {
    columnHeader: 'infographic',
    dbField: 'infographicName',
  },
];

export const exportLifestyles = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.Lifestyle;
  const columnHeaders = getColumnHeaders(spreadsheet.Lifestyle.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const lifestyles = await getLifestylesToExport(ctx, dbSimpleFields, propertyIdsToExport);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(lifestyles, columnHeadersOrderedMapped);
};
