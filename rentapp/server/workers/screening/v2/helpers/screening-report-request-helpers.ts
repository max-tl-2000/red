/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { ScreeningVersion } from '../../../../../../common/enums/screeningReportTypes';
import { IDbContext, IDictionaryHash } from '../../../../../../common/types/base-types';
import {
  IApplicationData,
  IApplicantReportRequestTracking,
  IScreeningReportOptions,
  IReportRequestData,
  IScreeningReportData,
  IRequestApplicantReportArgs,
  IFadvApplicantData,
  IApplicantReportRequestTrackingWithSettings,
  IApplicantData,
} from '../../../../helpers/applicant-types';
import config from '../../../../../config';
import loggerModule from '../../../../../../common/helpers/logger';
import { getScreeningRequestType, createFadvRawRequest, IFadvRawRequestOptions } from '../../screening-handler-request';
import { FadvRequestTypes } from '../../../../../../common/enums/fadvRequestTypes';
import { APPLICANT_TYPE_APPLICANT } from '../../../../helpers/base-fadv-helper';
import { obscureApplicantProperties } from '../../../../helpers/screening-helper';
import { isPendingRequestTrackingOnTime } from '../../../../helpers/applicant-report-helper';
import { updateApplicantReportRequestTracking } from '../../../../dal/applicant-report-request-tracking-repo';
import { FADV_RESPONSE_STATUS } from '../../../../../common/screening-constants';
import { postRawRequestToScreeningProvider } from '../../screening-provider-integration';
import { getActiveApplicantDataByPersonId } from '../../../../dal/applicant-data-repo';
import { getRequestReportIdfromRaw, getRequestTypefromRaw } from '../../../../../../common/helpers/utils';
import { assert } from '../../../../../../common/assert';

const logger = loggerModule.child({ subType: 'Screening report request helper' });

type GetApplicantsParams = {
  applicationData: IApplicationData;
  personId: string;
  isNotPendingWithoutReportId?: boolean;
};

// TODO: Ask Roberto why ctx is not used
export const getApplicants = (
  _ctx: IDbContext,
  latestApplicantReportRequest: IApplicantReportRequestTracking,
  { applicationData, personId, isNotPendingWithoutReportId }: GetApplicantsParams,
): Array<IApplicationData> => {
  const requestWithSSN: boolean = applicationData.requestWithSSN!;
  const applicantId = !latestApplicantReportRequest || isNotPendingWithoutReportId ? newId() : latestApplicantReportRequest.requestApplicantId;
  const applicant = {
    ...applicationData,
    applicantId,
    personId,
    type: APPLICANT_TYPE_APPLICANT,
    requestWithSSN,
  };

  if ((applicant.ssn || applicant.itin) && applicant.requestWithSSN) applicant.socSecNumber = applicant.ssn || applicant.itin;
  const { ssn, itin, ...otherApplicantInfo } = applicant;

  return [otherApplicantInfo];
};

const handlePendingTimeOutRequest = async (
  ctx: IDbContext,
  isPending: boolean,
  latestApplicantReportRequest: IApplicantReportRequestTracking,
): Promise<void> => {
  if (isPending && !isPendingRequestTrackingOnTime(latestApplicantReportRequest)) {
    assert(latestApplicantReportRequest.id, 'handlePendingTimeOutRequest: Missing latest applicant report request id');

    await updateApplicantReportRequestTracking(ctx, latestApplicantReportRequest.id!, {
      requestEndedAt: new Date(),
      hasTimedOut: true,
    } as IApplicantReportRequestTracking);
  }
};

const isForceNewReportRequested = async (
  ctx: IDbContext,
  latestApplicantReportRequest: IApplicantReportRequestTracking,
  screeningTypeRequested: string,
  isNotPendingWithoutReportId: boolean,
): Promise<boolean> => {
  if (!latestApplicantReportRequest) return true;
  const isPending = !latestApplicantReportRequest.requestEndedAt;

  await handlePendingTimeOutRequest(ctx, isPending, latestApplicantReportRequest);
  const isPendingWithNewStatus = isPending && latestApplicantReportRequest.requestType === FadvRequestTypes.NEW;
  return screeningTypeRequested === FadvRequestTypes.NEW || isNotPendingWithoutReportId || isPendingWithNewStatus;
};

const getScreeningReportOptions = async (
  ctx: IDbContext,
  latestApplicantReportRequest: IApplicantReportRequestTracking,
  screeningTypeRequested: string,
  isNotPendingWithoutReportId: boolean,
): Promise<IScreeningReportOptions> => {
  const screeningReportOptions = {
    storeRequest: true,
    version: ScreeningVersion.V2,
    requestType: getScreeningRequestType(screeningTypeRequested, FadvRequestTypes.NEW),
  };
  const forceNewReportRequested = await isForceNewReportRequested(ctx, latestApplicantReportRequest, screeningTypeRequested, isNotPendingWithoutReportId);
  if (forceNewReportRequested) {
    logger.trace({ ctx, screeningReportOptions }, 'forcing a new screening');
    return {
      ...screeningReportOptions,
      requestType: FadvRequestTypes.NEW,
    };
  }

  return {
    ...screeningReportOptions,
    reportId: latestApplicantReportRequest.externalReportId,
    requestType: getScreeningRequestType(screeningTypeRequested, FadvRequestTypes.MODIFY),
  };
};

export const getReportRequestData = async (
  ctx: IDbContext,
  latestApplicantReportRequest: IApplicantReportRequestTracking,
  // TODO: Ask Ivonne why applicantReportId was not used
  { /* applicantReportId, */ screeningTypeRequested, personId, reportName, applicationData, propertyId }: IRequestApplicantReportArgs,
): Promise<IReportRequestData> => {
  const { rentData } = config.fadv;
  logger.trace({ ctx, personId, reportName }, 'getReportRequestData');

  const isNotPendingWithoutReportId =
    latestApplicantReportRequest && latestApplicantReportRequest.requestEndedAt && !latestApplicantReportRequest.externalReportId;
  const screeningReportOptions: IScreeningReportOptions = await getScreeningReportOptions(
    ctx,
    latestApplicantReportRequest,
    screeningTypeRequested!,
    isNotPendingWithoutReportId!,
  );

  const applicantData: IFadvApplicantData = {
    tenantId: ctx.tenantId,
    applicants: getApplicants(ctx, latestApplicantReportRequest, {
      applicationData,
      personId,
      isNotPendingWithoutReportId,
    }),
  };

  const screeningReportData: IScreeningReportData = {
    rentData,
    propertyId,
    applicantData,
  };

  logger.trace(obscureApplicantProperties(screeningReportData), 'got screening report data');

  return { screeningReportData, screeningReportOptions };
};

export const handleImmediateScreeningResponse = async (
  ctx: IDbContext,
  { response, screeningRequestId }: { response: IDictionaryHash<any>; screeningRequestId: string },
): Promise<void> => {
  const responseNode = response.ApplicantScreening.Response[0];
  const status = responseNode.Status[0];
  logger.trace({ ctx, screeningRequestId, responseStatus: status }, 'handleImmediateScreeningResponse');

  const hadScreeningResult = status === FADV_RESPONSE_STATUS.COMPLETE;
  const fadvStatuses = [FADV_RESPONSE_STATUS.COMPLETE.toLowerCase(), FADV_RESPONSE_STATUS.INCOMPLETE.toLowerCase()];
  const externalReportId = responseNode.TransactionNumber && responseNode.TransactionNumber[0];
  if (fadvStatuses.includes(status.toLowerCase()) && externalReportId) {
    logger.trace(
      { ctx, screeningRequestId, responseStatus: status, hadScreeningResult },
      'handleImmediateScreeningResponse updating request with transactionNumber',
    );
    await updateApplicantReportRequestTracking(ctx, screeningRequestId!, {
      externalReportId,
      requestEndedAt: new Date(),
    } as IApplicantReportRequestTracking);
  } else {
    logger.error({ ctx, screeningRequestId }, 'missing transaction number on screening response');
  }

  const { handleScreeningResponseReceived } = require('../../screening-handler-response'); // eslint-disable-line global-require
  try {
    logger.trace({ ctx, screeningRequestId }, 'handleImmediateScreeningResponse calling responseReceived handler');
    await handleScreeningResponseReceived({ ...ctx, screeningResponse: response });
  } catch (err) {
    logger.error({ ctx, screeningRequestId, err }, 'unable to process immediate response!');
    throw err;
  }
};

export const prepareRawRequestForFadvResubmit = async (
  ctx: IDbContext,
  screeningRequest: IApplicantReportRequestTrackingWithSettings,
  applicantData: IFadvApplicantData,
) => {
  const rawRequestReportId = getRequestReportIdfromRaw(screeningRequest);
  const rawRequestType = getRequestTypefromRaw(screeningRequest);
  const { reportName } = screeningRequest;

  const options: IFadvRawRequestOptions = {
    submissionRequestId: screeningRequest.id as string,
    reportId: rawRequestReportId,
    requestType: rawRequestType,
    version: ScreeningVersion.V2,
    reportName,
  };

  const { rentData } = config.fadv;

  const { rawRequest } = await createFadvRawRequest(ctx, screeningRequest.propertyId, rentData, applicantData, options);

  return rawRequest;
};

export const handleScreeningResubmitRequest = async (ctx: IDbContext, screeningRequest: IApplicantReportRequestTrackingWithSettings) => {
  const screeningRequestId = screeningRequest.id!;
  logger.debug({ ctx, screeningRequestId }, 'handleScreeningResubmitRequest');
  const applicationData: IApplicationData = ((await getActiveApplicantDataByPersonId(ctx, screeningRequest.personId!)) || ({} as IApplicantData))
    .applicationData;

  const applicantData: IFadvApplicantData = {
    tenantId: ctx.tenantId,
    applicants: getApplicants(ctx, screeningRequest, {
      applicationData,
      personId: screeningRequest.personId!,
    }),
  };

  try {
    const rawRequest = await prepareRawRequestForFadvResubmit(ctx, screeningRequest, applicantData);

    const { response } = await postRawRequestToScreeningProvider(ctx, {
      screeningRequestId,
      payload: rawRequest,
    });
    await handleImmediateScreeningResponse(ctx, {
      response,
      screeningRequestId,
    });
  } catch (err) {
    logger.error({ err, ctx, screeningRequestId }, 'Unable to post message to screening provider');
    throw new Error('Unable to post message to screening provider');
  }
};
