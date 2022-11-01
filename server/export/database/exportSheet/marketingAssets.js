/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getMarketingAssetsToExport } from '../../../dal/marketingAssetsRepo';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';
import { getSimpleFieldsColumns, buildDataPumpFormat } from '../../helpers/export';

export const exportMarketingAssets = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const columnHeaders = getColumnHeaders(spreadsheet.MarketingAssets.columns);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders);

  const marketingAssets = await getMarketingAssetsToExport(ctx, dbSimpleFields);

  return buildDataPumpFormat(marketingAssets, columnHeadersOrdered);
};
