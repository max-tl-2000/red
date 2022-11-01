/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getScreeningCriteriasToExport } from '../../../dal/screeningCriteriaRepo';
import { buildDataPumpFormat } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

export const exportScreeningCriterias = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const columnHeaders = getColumnHeaders(spreadsheet.ScreeningCriteria.columns);

  const screeningCriterias = await getScreeningCriteriasToExport(ctx, columnHeaders);

  return buildDataPumpFormat(screeningCriterias, columnHeadersOrdered);
};
