/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../../common/helpers/logger';
import { getScreeningVersion } from '../../helpers/screening-helper';
import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes';
import { IDbContext, IConsumerResult } from '../../../../common/types/base-types';
import { handlePollScreeningUnreceivedResponses as handlePollScreeningUnreceivedResponsesV1 } from './v1/screening-report-request-handler';
import { handlePollScreeningUnreceivedResponses as handlePollScreeningUnreceivedResponsesV2 } from './v2/screening-report-request-handler';

const logger = loggerModule.child({ subType: 'Application Screening Handler' });

export const handlePollScreeningUnreceivedResponses = async (ctx: IDbContext): Promise<IConsumerResult> => {
  logger.time({ ctx }, 'Recurring Jobs - handlePollScreeningUnreceivedResponses duration');

  const screeningVersion = await getScreeningVersion(ctx);

  if (screeningVersion === ScreeningVersion.V1) {
    return await handlePollScreeningUnreceivedResponsesV1(ctx);
  }

  const result = await handlePollScreeningUnreceivedResponsesV2(ctx);

  logger.timeEnd({ ctx }, 'Recurring Jobs - handlePollScreeningUnreceivedResponses duration');

  return result;
};
