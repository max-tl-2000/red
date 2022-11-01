/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';
import { getSimpleFieldsColumns, buildDataPumpFormat } from '../../helpers/export';
import { getPropertiesGroupToExport } from '../../../dal/propertyGroupRepo';

export const exportPropertyGroups = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.PropertyGroup;
  const columnHeaders = getColumnHeaders(spreadsheet.PropertyGroup.columns);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, foreignKeys);

  const propertiesGroup = await getPropertiesGroupToExport(ctx, dbSimpleFields);

  return buildDataPumpFormat(propertiesGroup, columnHeadersOrdered);
};
