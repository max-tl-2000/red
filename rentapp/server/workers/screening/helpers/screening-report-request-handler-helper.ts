/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import loggerModule from '../../../../../common/helpers/logger';
import { getScreeningRequest } from '../../../services/screening';
import { NoRetryError } from '../../../../../server/common/errors';
import { obscureApplicantProperties } from '../../../helpers/screening-helper';
import { IRequestApplicantReportArgs, IScreeningReportOptions, ScreeningResponseOrigin } from '../../../helpers/applicant-types';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';
import { ScreeningVersion } from '../../../../../common/enums/screeningReportTypes';
import { postToScreeningProvider, processScreeningResponseReceived } from '../screening-provider-integration-handler';
import { getReportRequestData } from '../v2/helpers/screening-report-request-helpers';
import { SCREENING_MESSAGE_TYPE } from '../../../../../server/helpers/message-constants';
import { IDictionaryHash, IConsumerResult, IDbContext } from '../../../../../common/types/base-types';
import { getApplicantReportRequestWithApplicantData } from '../../../dal/applicant-report-request-tracking-repo';
import { handleFADVResponseError } from './screening-report-response-handler-helper';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import { PARSE_EXCEPTION } from '../../../../../common/helpers/postXML';
import { PARSE_ERROR } from '../../../../common/screening-constants';

const logger = loggerModule.child({ subType: 'Application Screening Handler' });
const decryptSsn = true;

const getOrphanedScreeningRequest = async (
  ctx: IDbContext,
  screeningData: { screeningRequestId: string; personId?: string; reportName?: string; propertyId?: string; reportId?: string },
): Promise<IDictionaryHash<any>> => {
  const { screeningVersion } = ctx;
  const { screeningRequestId, personId, reportName, propertyId, reportId } = screeningData;

  if (!screeningVersion || screeningVersion === ScreeningVersion.V1) {
    return await getScreeningRequest(ctx, screeningRequestId, decryptSsn);
  }

  let latestApplicantReportRequest;
  const screeningRequest = await getApplicantReportRequestWithApplicantData(ctx, screeningRequestId);
  const { screeningReportData } = await getReportRequestData(ctx, latestApplicantReportRequest, {
    applicantReportId: reportId,
    screeningTypeRequested: FadvRequestTypes.VIEW,
    personId,
    reportName,
    applicationData: screeningRequest.applicantData,
    propertyId,
  } as IRequestApplicantReportArgs);

  const { rentData, applicantData } = screeningReportData;

  return {
    ...screeningRequest,
    rentData,
    applicantData,
    reportName,
  };
};

export const handleScreeningSubmitViewRequestReceived = async (msg: IDictionaryHash<any>): Promise<IConsumerResult> => {
  const { screeningRequestId, partyApplicationId, ...ctx } = msg;
  const handlerCtx = { ...ctx } as IDbContext;
  const { tenantId, screeningVersion: version = ScreeningVersion.V1, reportId, personId, reportName, propertyId } = handlerCtx;
  const responseOrigin = ScreeningResponseOrigin.POLL;

  logger.debug({ ctx: handlerCtx, screeningRequestId, screeningVersion: version }, 'handleScreeningSubmitViewRequestReceived');
  if (!tenantId) throw new NoRetryError('msg was missing tenantId');
  if (!screeningRequestId) throw new NoRetryError('msg was missing screeningRequestId');

  const screeningRequest = await getOrphanedScreeningRequest(handlerCtx, { screeningRequestId, personId, reportName, propertyId, reportId });

  logger.info({ ctx: handlerCtx, partyApplicationId, screeningRequestId }, 'handleScreeningSubmitViewRequestReceived');

  try {
    const applicantData = await screeningRequest.applicantData;
    const options: IScreeningReportOptions = {
      storeRequest: false,
      requestType: FadvRequestTypes.VIEW,
      reportId: screeningRequest.transactionNumber,
      submissionRequestId: screeningRequestId,
      reportName,
      version,
    };

    const eventType = SCREENING_MESSAGE_TYPE.SCREENING_SUBMIT_VIEW_REQUEST_RECEIVED;
    const { response } = await postToScreeningProvider(
      handlerCtx,
      screeningRequest.propertyId,
      { ...screeningRequest.rentData, quoteId: screeningRequest.quoteId },
      applicantData,
      { ...options, eventType },
    );
    const fadvResponseLog = omit(response.ApplicantScreening.Response[0], ['BackgroundReport']);
    logger.info({ ctx: handlerCtx, ...obscureApplicantProperties(fadvResponseLog) }, 'postToScreeningProvider got response');

    const fadvResponse = response.ApplicantScreening.Response[0];
    const status = fadvResponse.Status[0];
    logger.info({ ctx: handlerCtx, fadvResponseStatus: status }, 'Sending response from FADV as a posted notification');
    await processScreeningResponseReceived(handlerCtx, response, { version, responseOrigin });
  } catch (err) {
    logger.error({ err, ctx: handlerCtx, screeningRequestId }, 'Unable to post message to screening provider');

    if (err.msg === PARSE_EXCEPTION || err.token === PARSE_ERROR) {
      await handleFADVResponseError(ctx, err.data, ScreeningDecision.ERROR_RESPONSE_UNPARSABLE, {
        screeningRequestId: err.screeningRequestId,
        responseOrigin,
      });
      return { processed: false } as IConsumerResult;
    }
    throw new Error('Unable to post message to screening provider');
  }

  return { processed: true } as IConsumerResult;
};
