/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLastExecutedLeaseByQuoteIdQuery } from '../../dal/leaseRepo';
import { VIEW_MODEL_TYPES } from './enums';
import { MONTH_DATE_YEAR_LONG_FORMAT } from '../../../common/date-constants';
import { toMoment, formatMoment } from '../../../common/helpers/moment-utils';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, options) =>
  getLastExecutedLeaseByQuoteIdQuery(ctx, options.quoteId, options.propertyId, options.seedPartyAllowedWorkflowStates).toString();

export const tokensMapping = {
  endDate: ({ leaseEndDate }, { timezone }) => formatMoment(leaseEndDate, { format: MONTH_DATE_YEAR_LONG_FORMAT, timezone }),
  residentMoveoutNoticePeriod: ({ residentMoveoutNoticePeriod }) => `${residentMoveoutNoticePeriod}-day`,
  residentNoticeDeadline: ({ leaseEndDate, residentMoveoutNoticePeriod }, { timezone }) =>
    toMoment(leaseEndDate, { timezone }).subtract(parseInt(residentMoveoutNoticePeriod, 10), 'days').format(MONTH_DATE_YEAR_LONG_FORMAT),
  length: ({ leaseTermLength }) => `${leaseTermLength}-month`,
};
