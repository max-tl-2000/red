/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getEmployeesToExport } from '../../../dal/usersRepo';
import { buildDataPumpFormat, getColumnHeadersMappedWithDB } from '../../helpers/export';

const DB_MAPPERS = [
  {
    columnHeader: 'registrationEmail',
    dbField: 'email',
  },
  {
    columnHeader: 'userUniqueId',
    dbField: 'externalUniqueId',
  },
];

export const exportEmployees = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const employees = await getEmployeesToExport(ctx);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(employees, columnHeadersOrderedMapped);
};
