/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getMarketingLayoutGroupsToExport } from '../../../dal/marketingLayoutGroupsRepo';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';
import { getSimpleFieldsColumns, buildDataPumpFormat } from '../../helpers/export';

export const exportMarketingLayoutGroups = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.MarketingLayoutGroups;
  const columnHeaders = getColumnHeaders(spreadsheet.MarketingLayoutGroups.columns);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, foreignKeys);

  const marketingLayoutGroups = await getMarketingLayoutGroupsToExport(ctx, dbSimpleFields);

  return buildDataPumpFormat(marketingLayoutGroups, columnHeadersOrdered);
};
