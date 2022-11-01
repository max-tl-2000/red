/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes';
import { postToScreeningProvider as postToScreeningProviderV1 } from './screening-provider-integration';
import { postToScreeningProvider as postToScreeningProviderV2 } from './v2/screening-provider-integration.ts';
import { processScreeningResponseReceived as processScreeningResponseReceivedV1 } from './v1/screening-report-response-handler';
import { processScreeningResponseReceived as processScreeningResponseReceivedV2 } from './v2/screening-report-response-handler';
import loggerModule from '../../../../common/helpers/logger';
import { ScreeningResponseOrigin } from '../../helpers/applicant-types';

const logger = loggerModule.child({ subType: 'workflow' });

export const postToScreeningProvider = async (ctx, propertyId, rentData, applicantData, options = {}) => {
  const { version = ScreeningVersion.V1 } = options;
  logger.trace({ ctx, screeningVersion: version }, 'postToScreeningProvider');

  const actionResult = await (version === ScreeningVersion.V2
    ? postToScreeningProviderV2(ctx, propertyId, rentData, applicantData, options)
    : postToScreeningProviderV1(ctx, propertyId, rentData, applicantData, options));

  logger.trace('Leaving postToScreeningProvider');

  return actionResult;
};

export const processScreeningResponseReceived = async (ctx, response, options = {}) => {
  const { version = ScreeningVersion.V1, responseOrigin = ScreeningResponseOrigin.POLL } = options;
  logger.trace({ ctx, screeningVersion: version }, 'processScreeningResponseReceived');

  const actionResult = await (version === ScreeningVersion.V2
    ? processScreeningResponseReceivedV2(ctx, response)
    : processScreeningResponseReceivedV1(ctx, response, responseOrigin));

  logger.trace('Leaving processScreeningResponseReceived');

  return actionResult;
};
