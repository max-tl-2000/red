/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTeamMemberSalesTargetsToExport } from '../../../dal/teamMemberSalesTargetRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

export const exportTeamMemberSalesTargets = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.TeamMemberSalesTarget;
  const columnHeaders = getColumnHeaders(spreadsheet.TeamMemberSalesTarget.columns);

  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, foreignKeys);
  const teamMemberSalesTargets = await getTeamMemberSalesTargetsToExport(ctx, dbSimpleFields, propertyIdsToExport);

  return buildDataPumpFormat(teamMemberSalesTargets, columnHeadersOrdered);
};
