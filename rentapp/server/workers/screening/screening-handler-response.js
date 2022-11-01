/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes.ts';
import { processScreeningResponseReceived as processScreeningResponseV1Received } from './v1/screening-report-response-handler';
import { processScreeningResponseReceived as processScreeningResponseV2Received } from './v2/screening-report-response-handler';
import { parseCustomRecords, validateScreeningResponse } from '../../screening/fadv/screening-report-parser.ts';
import { NoRetryError } from '../../../../server/common/errors';

import loggerModule from '../../../../common/helpers/logger';
import { ScreeningResponseOrigin } from '../../helpers/applicant-types';

const logger = loggerModule.child({ subType: 'Application Screening Handler' });

/**
 * Handler for Screening response received
 *
 * @param {Object} screeningResponse is already-parsed response object which is extracted from Queue to be processed
 * @return {Object} return { processed: true } when it is handled correctly
 *                  { processed: false } when there is an error
 * As this is a webhook, we don't know the tenantId until 'handleParsedFADVResponse' returns
 */
export const handleScreeningResponseReceived = async msg => {
  const { screeningResponse, ...ctx } = msg;
  logger.trace({ ctx }, 'handleScreeningResponseReceived');

  const validationResult = validateScreeningResponse(screeningResponse);
  if (!validationResult.isValid) {
    logger.error({ screeningResponse, errors: validationResult.errors }, 'screening response is invalid');
    throw new NoRetryError(validationResult.errors.join(', '));
  }

  const { version = ScreeningVersion.V1 } = parseCustomRecords(screeningResponse.ApplicantScreening.CustomRecords) || {};

  const actionResult = await (version === ScreeningVersion.V2
    ? processScreeningResponseV2Received(ctx, screeningResponse)
    : processScreeningResponseV1Received(ctx, screeningResponse, ScreeningResponseOrigin.PUSH));

  logger.trace({ ctx }, 'Leaving handleScreeningResponseReceived');

  return actionResult;
};
