/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getBusinessEntitiesToExport } from '../../../dal/businessEntityRepo';
import { buildDataPumpFormat, getForeignKeysColumns, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

const BUSINESS_ENTITY_FOREIGN_KEYS = [
  {
    tableRef: 'Address',
    fields: [
      {
        columnHeader: 'addressLine1',
        dbField: 'addressLine1',
      },
      {
        columnHeader: 'addressLine2',
        dbField: 'addressLine2',
      },
      {
        columnHeader: 'city',
        dbField: 'city',
      },
      {
        columnHeader: 'state',
        dbField: 'state',
      },
      {
        columnHeader: 'postalCode',
        dbField: 'postalCode',
      },
    ],
  },
];

export const exportBusinessEntity = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const columnHeaders = getColumnHeaders(spreadsheet.BusinessEntity.columns);

  const dbForeigKeys = getForeignKeysColumns(BUSINESS_ENTITY_FOREIGN_KEYS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, dbForeigKeys);

  const businessEntities = await getBusinessEntitiesToExport(ctx, dbSimpleFields, BUSINESS_ENTITY_FOREIGN_KEYS);

  return buildDataPumpFormat(businessEntities, columnHeadersOrdered);
};
