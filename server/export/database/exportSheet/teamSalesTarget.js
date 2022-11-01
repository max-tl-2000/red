/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTeamSalesTargetsToExport } from '../../../dal/teamSalesTargetRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

export const exportTeamSalesTargets = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.TeamSalesTarget;
  const columnHeaders = getColumnHeaders(spreadsheet.TeamSalesTarget.columns);

  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, foreignKeys);
  const teamSalesTargets = await getTeamSalesTargetsToExport(ctx, dbSimpleFields);

  return buildDataPumpFormat(teamSalesTargets, columnHeadersOrdered);
};
