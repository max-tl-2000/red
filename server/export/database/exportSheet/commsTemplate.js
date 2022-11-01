/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getCommsTemplatesToExport } from '../../../dal/commsTemplateRepo';
import { buildDataPumpFormat, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

const DB_MAPPERS = [
  {
    columnHeader: 'inactiveFlag',
    dbField: 'inactive',
  },
];

export const exportCommsTemplates = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const columnHeaders = getColumnHeaders(spreadsheet.CommsTemplate.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const commsTemplates = await getCommsTemplatesToExport(ctx, columnHeadersMapped);
  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);

  return buildDataPumpFormat(commsTemplates, columnHeadersOrderedMapped);
};
