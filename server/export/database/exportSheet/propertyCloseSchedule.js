/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertiesCloseScheduleToExport } from '../../../dal/propertyCloseScheduleRepo';
import { buildDataPumpFormat, getForeignKeysColumns, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

const PROPERTY_CLOSE_SCHEDULE_FOREIGN_KEYS = [
  {
    tableRef: 'Property',
    fields: [
      {
        columnHeader: 'propertyName',
        dbField: 'name',
      },
    ],
  },
];

export const exportPropertyCloseSchedule = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const columnHeaders = getColumnHeaders(spreadsheet.PropertyCloseSchedule.columns);

  const dbForeigKeys = getForeignKeysColumns(PROPERTY_CLOSE_SCHEDULE_FOREIGN_KEYS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, dbForeigKeys);

  const propertiesCloseSchedule = await getPropertiesCloseScheduleToExport(ctx, dbSimpleFields, PROPERTY_CLOSE_SCHEDULE_FOREIGN_KEYS, propertyIdsToExport);

  return buildDataPumpFormat(propertiesCloseSchedule, columnHeadersOrdered);
};
