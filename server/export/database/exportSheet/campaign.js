/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getCampaignsToExport } from '../../../dal/campaignsRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

export const exportCampaigns = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.Campaign;
  const columnHeaders = getColumnHeaders(spreadsheet.Campaign.columns);

  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, foreignKeys);
  const campaigns = await getCampaignsToExport(ctx, dbSimpleFields);

  return buildDataPumpFormat(campaigns, columnHeadersOrdered);
};
