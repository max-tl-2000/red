/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTeamMembersToExport } from '../../../dal/teamsRepo';
import { buildDataPumpFormat, getColumnHeadersMappedWithDB } from '../../helpers/export';

const DB_MAPPERS = [
  {
    columnHeader: 'inactiveFlag',
    dbField: 'inactive',
  },
];

export const exportTeamMembers = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const teamMembers = await getTeamMembersToExport(ctx);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(teamMembers, columnHeadersOrderedMapped);
};
