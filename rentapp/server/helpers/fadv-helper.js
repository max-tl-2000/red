/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { assert } from '../../../common/assert';
import logger from '../../../common/helpers/logger';
import { createSubmissionRequest, getParentSubmissionRequestId } from '../dal/fadv-submission-repo';
import { obscureApplicantProperties } from './screening-helper';
import { FadvRequestTypes } from '../../../common/enums/fadvRequestTypes';
import { getRequestTypefromRaw, getRequestReportIdfromRaw } from '../../../common/helpers/utils';
import { maskSSNInApplicants } from './fadv-mask-applicant-ssn';
import { getScreeningRequestDataDiff } from './fadv-screening-data-diff-helper';
import { getPrevSubmissionRequestData } from '../services/screening';
import { createFadvRawRequest } from '../workers/screening/screening-handler-request.ts';

export const isScreeningRequestTypeValid = requestType => requestType && Object.values(FadvRequestTypes).includes(requestType);

/* const createASubmissionRequest = async (
  ctx,
  submissionRequestId,
  propertyId,
  rentData,
  applicantData,
  quoteId,
  rawRequest,
  requestType = FadvRequestTypes.NEW,
) => {
  const partyApplicationId = applicantData.partyApplicationId;
  const parentSubmissionRequestId = await getParentSubmissionRequestId(ctx, partyApplicationId);
  const submissionRequestData = {
    id: submissionRequestId,
    partyApplicationId,
    rawRequest,
    propertyId,
    rentData,
    applicantData,
    quoteId,
    requestType,
    parentSubmissionRequestId,
  };
  return await createSubmissionRequest(ctx, submissionRequestData);
}; */

const createASubmissionRequest = async (
  ctx,
  submissionRequestId,
  propertyId,
  rentData,
  applicantData,
  quoteId,
  eventType,
  requestDataDiff,
  newOptions,
  requestType = FadvRequestTypes.NEW,
) => {
  const partyApplicationId = applicantData.partyApplicationId;
  const { rawRequest } = await createFadvRawRequest(ctx, propertyId, rentData, maskSSNInApplicants(applicantData), newOptions);
  const parentSubmissionRequestId = await getParentSubmissionRequestId(ctx, partyApplicationId);

  const submissionRequestData = {
    id: submissionRequestId,
    partyApplicationId,
    rawRequest,
    propertyId,
    rentData,
    applicantData,
    quoteId,
    requestType,
    parentSubmissionRequestId,
    origin: eventType,
    requestDataDiff,
  };

  return await createSubmissionRequest(ctx, submissionRequestData);
};

const getFadvRequestDataDiff = async (ctx, applicantData, quoteId, rentData) => {
  const requestDataFilter = { quoteId, leaseTermMonths: rentData.leaseTermMonths };

  const previousSubmissionRequestData = await getPrevSubmissionRequestData(ctx, applicantData.partyApplicationId, requestDataFilter);
  if (!previousSubmissionRequestData) return null;

  const currentRequestData = { applicantData, rentData };
  const previousRequestData = {
    applicantData: previousSubmissionRequestData.applicantData || applicantData,
    rentData: previousSubmissionRequestData.rentData || rentData,
  };

  return getScreeningRequestDataDiff(previousRequestData, currentRequestData);
};

/**
 * Create and store a FADV Submision Request, will include a screening request id as custom records
 *
 * @param {string} propertyId - Property name
 * @param {Object} rentData - Rent data which will be posted to FADV service
 * @param {Object} rentData - Lease terms of the applicants
 * @param {number} rentData.monthlyRent - Monthly rent
 * @param {number} rentData.leaseMonths - Lease months
 * @param {Object} applicantData - Applicants who are posted to FADV service
 * @param {Object[]} applicantData.applicants - Applicants list to be posted
 * @param {Object} applicantData.applicants[].name - Applicant's full name property
 * @param {string} applicantData.applicants[].name.firstName - Applicant's first name
 * @param {string} applicantData.applicants[].name.lastName - Applicant's last name
 * @param {string} applicantData.partyApplicationId
 * @param {string} quoteId - the quote id associated with the submission request
 * @param {string} eventType - the type of event that originated the submission request
 * @param {Object} options - additional options to create the screening
 * @param {Object} options.requestType - fadv request type: New, Modify, View
 * @param {number} options.reportId - reportId of previous screening
*  @return {Object} object with fadv request
*    @param rawRequest {String} raw request
*    @param id {Guid} screening request id

*/
export const createAndStoreFadvRequest = async (ctx, propertyId, rentData, applicantData, quoteId, eventType, options) => {
  assert(rentData && rentData !== {}, 'createAndStoreFadvRequest: rentData is missing or empty!');
  logger.debug({ ctx, propertyId, rentData, quoteId, options, ...obscureApplicantProperties(applicantData) }, 'createAndStoreFadvRequest');

  const submissionRequestId = newId();
  const newOptions = {
    ...options,
    submissionRequestId,
  };

  const requestDataDiff = await getFadvRequestDataDiff(ctx, applicantData, quoteId, rentData);

  const submissionRequestResult = await createASubmissionRequest(
    ctx,
    submissionRequestId,
    propertyId,
    rentData,
    applicantData,
    quoteId,
    eventType,
    requestDataDiff,
    newOptions,
    options.requestType,
  );
  assert(submissionRequestResult.id === submissionRequestId, 'createAndStoreFadvRequest: the submissionRequest id is different');
  logger.debug({ ctx }, 'created submission request');

  const { rawRequest } = await createFadvRawRequest(ctx, propertyId, rentData, applicantData, newOptions);
  logger.debug({ ctx }, 'created raw request');

  logger.debug(
    {
      ctx,
      submissionRequestId,
      propertyId,
      rentData,
      ...obscureApplicantProperties(applicantData),
    },
    'createAndStoreFadvRequest created request',
  );

  return { rawRequest, id: submissionRequestResult.id };
};

export const prepareRawRequestForFadv = async (ctx, submissionRequest, applicantData) => {
  logger.trace({ ctx }, 'prepareRawRequestForFadv');

  const rawRequestType = getRequestTypefromRaw(submissionRequest);
  const rawRequestReportId = getRequestReportIdfromRaw(submissionRequest);

  const options = {
    submissionRequestId: submissionRequest.id,
    requestType: rawRequestType,
    reportId: rawRequestReportId,
  };

  const { rawRequest } = await createFadvRawRequest(ctx, submissionRequest.propertyId, submissionRequest.rentData, applicantData, options);

  return rawRequest;
};
