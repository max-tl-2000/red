/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSubmissionResponse, getSubmissionResponseBySubmissionRequestId } from '../../../dal/fadv-submission-repo';
import { DALTypes } from '../../../../../common/enums/DALTypes';
import loggerModule from '../../../../../common/helpers/logger';
import { shouldStoreScreeningResponse } from '../screening-helper';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import { NoRetryError } from '../../../../../server/common/errors';

const logger = loggerModule.child({ subType: 'Application Screening Response Handler' });

const { ScreeningRecommendation } = DALTypes;

export const handleFADVResponseError = async (ctx, rawResponse, error, { screeningRequestId, responseOrigin }) => {
  logger.error({ ctx, fadvError: error, screeningRequestId }, 'handleFADVResponseError');
  if (!screeningRequestId) throw new NoRetryError('screeningRequestId is required');
  const submissionResponse = {
    submissionRequestId: screeningRequestId,
    rawResponse,
    applicationDecision: error,
    origin: responseOrigin,
  };

  const recommendation = { id: 'reva-error' };

  if (error === ScreeningDecision.ERROR_RESPONSE_UNPARSABLE) {
    recommendation.text = ScreeningRecommendation.GENERIC_ERROR_RECOMMENDATION;
  } else {
    submissionResponse.externalId = rawResponse.ApplicantScreening.Response[0].RequestID_Returned[0];
    recommendation.text =
      error === ScreeningDecision.ERROR_ADDRESS_UNPARSABLE
        ? ScreeningRecommendation.ERROR_ADDRESS_UNPARSABLE_RECOMMENDATION
        : ScreeningRecommendation.GENERIC_ERROR_RECOMMENDATION;
  }

  submissionResponse.recommendations = [recommendation];
  const previousResponse = await getSubmissionResponseBySubmissionRequestId(ctx, screeningRequestId, false);
  if (!shouldStoreScreeningResponse(ctx, { submissionRequestId: screeningRequestId, submissionResponse, lastStoredResponse: previousResponse })) {
    logger.info({ ctx, screeningRequestId }, 'Screening request has already a response with the same data, so doing nothing');
  } else {
    await createSubmissionResponse(ctx, submissionResponse);
  }
};
