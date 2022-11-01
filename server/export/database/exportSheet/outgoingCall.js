/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getOutgoingCallsToExport } from '../../../dal/programsRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

export const exportOutgoingCalls = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.OutgoingCall;
  const columnHeaders = getColumnHeaders(spreadsheet.OutgoingCall.columns);

  const dbSimpleFields = getSimpleFieldsColumns(columnHeaders, foreignKeys);
  const outgoingCalls = await getOutgoingCallsToExport(ctx, dbSimpleFields, propertyIdsToExport);

  return buildDataPumpFormat(outgoingCalls, columnHeadersOrdered);
};
