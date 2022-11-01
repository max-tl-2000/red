/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// import https from 'https';
// import { StringDecoder } from 'string_decoder';
import { request as httpRequest } from '../../../../common/helpers/httpUtils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { saveLeaseSubmission, updateLeaseSubmission } from '../../../dal/leaseRepo';

import BluemoonApiError from './BluemoonApiError';

import { assert } from '../../../../common/assert';

import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({
  subType: 'bluemoonApiClient',
});

import { getAccessToken } from './tokenMgr';

/* Reva-specific assumptions about our BM Implementation:
 * We NEVER ask BM to send notifications to signers (this is managed by the send_notification flag)
 * We NEVER delete leases or signatures
 */

const getHostname = _isProd => 'api.bluemoonforms.com';
//     // TODO: dev does not seem to work // isProd ? "api.bluemoonforms.com" : "api.bluemoonformsdev.com"

const timeout = 20000;

// revaLeaseId is needed in order to save request/response
const sendRequest = async (ctx, revaPropertyId, requestPath, requestBody, revaLeaseId, envelopeId, submissionType, requestorData = {}, options = {}) => {
  const hostname = getHostname();
  const url = `https://${hostname}${requestPath}`;
  const method = options.method || 'get';
  logger.trace(
    {
      ctx,
      url,
      requestPath,
      requestBody,
      method,
      submissionType,
      requestorData,
      options,
      revaPropertyId,
    },
    'Send bluemoon request',
  );

  const accessToken = await getAccessToken(ctx, revaPropertyId);
  logger.info({ ctx, accessToken, requestPath, revaLeaseId, envelopeId, revaPropertyId }, 'Got access token');

  // TODO: figure out why logger is not filtering out token contents
  const requestOptions = {
    timeout,
    type: 'json',
    data: requestBody,
    buffer: true,
    alwaysReturnText: true, // We do not want SA to parse JSON, so will always return text for that case
    headers: {
      Accept: '*/*',
      Authorization: `Bearer ${accessToken}`,
      // x-reva-request-id: { ctx.reqId },
    },
    debug: true,
    ...options,
    method,
  };

  logger.trace(
    {
      ctx,
      requestPath,
      requestOptions,
    },
    'Send bluemoon request',
  );

  let responseBody;
  try {
    let submissionId;
    if (revaLeaseId) {
      const leaseSubmission = { leaseId: revaLeaseId, request: requestBody || url, type: submissionType, envelopeId };
      if (requestorData?.clientUserId) leaseSubmission.clientUserId = requestorData.clientUserId;
      if (requestorData?.submissionType) leaseSubmission.type = requestorData.submissionType;

      const { id } = await saveLeaseSubmission(ctx, leaseSubmission, false);
      submissionId = id;
    }

    responseBody = await httpRequest(url, requestOptions);

    // not great to do this here, but planning to refactor anyway, so...
    let submissionResponse = responseBody || '';
    if (submissionType === 'GetPDF') submissionResponse = 'signed document fetched';

    submissionId && (await updateLeaseSubmission(ctx, { id: submissionId, response: submissionResponse }, false));
  } catch (error) {
    logger.error({ ctx, error, requestOptions, responseBody }, 'Error while calling Bluemoon API');

    throw new BluemoonApiError(ctx, 'Error while calling Bluemoon API', requestOptions, responseBody, error);
  }
  logger.debug(
    {
      ctx,
      requestOptions,
      // responseBody, // don't log this - it can be very verbose
    },
    'got blue moon response',
  );
  if (requestOptions.type !== 'json') return responseBody;
  const jsonBody = JSON.parse(responseBody);
  if (jsonBody?.success === false) {
    // note not all calls return a success property
    logger.error({ ctx, requestOptions, jsonBody }, 'Bluemoon reported not successful');
    throw new BluemoonApiError(ctx, 'Bluemoon reported not successful', jsonBody, responseBody);
  }
  return { ...jsonBody, _responseBody: responseBody };
};

// Attempts (1 time) to send the request body to the specified path.  Returns the parsed response body
// if there is not an error;  throws a BluemoonApiError otherwise.
const sendPostRequest = async (ctx, revaPropertyId, requestPath, requestBody, revaLeaseId, envelopeId, submissionType, requestorData = {}, options = {}) =>
  await sendRequest(ctx, revaPropertyId, requestPath, requestBody, revaLeaseId, envelopeId, submissionType, requestorData, { ...options, method: 'post' });

/* returns BM id of successfully created lease, or throws error */
/* eslint-disable camelcase */
const createLease = async (ctx, revaPropertyId, leaseId, propertyId, standardFields, customFields) => {
  const request = {
    property_id: propertyId,
    standard: standardFields,
    custom: customFields,
  };
  const bmLease = await sendPostRequest(ctx, revaPropertyId, '/api/lease', request, leaseId, null, 'CreateLease');
  if (!bmLease.id) {
    throw new BluemoonApiError(ctx, 'Error while calling Bluemoon API: Did not receive a bmLeaseId', leaseId, request);
  }

  return `${bmLease.id}`;
};

const deleteLease = async (ctx, revaPropertyId, revaLeaseId, envelopeId, bmLeaseid) => {
  const leaseDeletionResponse = await sendRequest(ctx, revaPropertyId, `/api/lease/${bmLeaseid}`, null, revaLeaseId, envelopeId, 'DeleteLease', null, {
    method: 'delete',
  });

  if (!leaseDeletionResponse.deleted) {
    logger.error({ ctx, revaPropertyId, revaLeaseId, envelopeId, bmLeaseid }, 'deleteLease: Error while calling Bluemoon API: Could not be deleted');
  }
};

// TODO: add optional params
// each signer has email, phone, and optional externalId
const createLeaseESignatureRequest = async (ctx, revaPropertyId, revaLeaseId, bmLeaseId, standardFormNames, signers, redirectUrl, notificationUrl) => {
  const request = {
    lease_id: bmLeaseId,
    send_notifications: false, // see earlier comment
    data: {
      standard_forms: standardFormNames,
      signers,
    },
  };
  if (redirectUrl) {
    request.data.redirect_url = redirectUrl;
  }
  if (notificationUrl) {
    request.notification_url = redirectUrl;
    request.send_notifications = true;
  }
  const esigResponse = await sendPostRequest(ctx, revaPropertyId, '/api/esignature/lease/', request, revaLeaseId, null, 'CreateEnvelope');
  if (!esigResponse.data.id) {
    throw new BluemoonApiError(ctx, 'Error while calling Bluemoon API: Did not receive a esignRequestId', revaLeaseId, request);
  }
  /* sample response:
   responseBody: '{"data":{"id":6108937,"lease_id":82230000,"esign_id":0,"external_id":null,"status":"initial","send_notifications":false,"notification_url":"","data":{"standard_forms":["APTLEASE"],"lease_id":82230000,"esign_id":null},"errors":[],"document_url":"https:\\/\\/api.bluemoonforms.com\\/api\\/esignature\\/lease\\/pdf\\/6108937","countersign_url":"https:\\/\\/api.bluemoonforms.com\\/api\\/esignature\\/lease\\/execute\\/6108937","created_at":"2021-10-18T21:39:37+00:00","updated_at":"2021-10-18T21:39:37+00:00","forms":["Apartment Lease Form"]},"success":true}'
  */
  return `${esigResponse.data.id}`;
};

const deleteLeaseESignatureRequest = async (ctx, revaPropertyId, revaLeaseId, envelopeId, esigRequestId) => {
  const esigResponse = await sendRequest(
    ctx,
    revaPropertyId,
    `/api/esignature/lease/${esigRequestId}`,
    null,
    revaLeaseId,
    envelopeId,
    'DeleteESignature',
    null,
    {
      method: 'delete',
    },
  );

  if (!esigResponse.deleted) {
    logger.error(
      { ctx, revaPropertyId, revaLeaseId, envelopeId, esigRequestId },
      'deleteLeaseESignatureRequest: Error while calling Bluemoon API: Could not be deleted',
    );
  }
};

const convertSignerStatuses = (ctx, bmSigners) => {
  // The owner url is not specified as we are supposed to use the execute action as the countersignature.
  // For completeness, building the url suing teh resident_1 url as a model
  const resident1Url = bmSigners.filter(rawStatus => rawStatus.identifier === 'resident_1')[0]?.signature_url || '';
  const baseSignatureUrl = `${resident1Url}`.replace(/([^/]*)$/, '');

  const signerStatuses = bmSigners.map(rawStatus => ({
    clientUserId:
      rawStatus.identifier === 'owner' ? 'CounterSigner1' : rawStatus.identifier.replace('resident_', 'Resident').replace('guarantor_', 'Guarantor'),
    recipientStatus: rawStatus.completed ? DALTypes.LeaseStatusEvent.COMPLETED : '',
    userName: rawStatus.name,
    email: rawStatus.email,
    signatureLink: rawStatus.signature_url || `${baseSignatureUrl}${rawStatus.id}`,
    signedDate: rawStatus.date_signed,
    counterSigner: rawStatus.identifier === 'owner',
  }));

  return signerStatuses;
};

// returns list of applicants who have signed
const getLeaseESignatureRequest = async (ctx, revaPropertyId, revaLeaseId, envelopeId, esigRequestId, requestorData = {}) => {
  const esigResponse = await sendRequest(
    ctx,
    revaPropertyId,
    `/api/esignature/lease/${esigRequestId}`,
    null,
    revaLeaseId,
    envelopeId,
    'GetEnvelopeStatus',
    requestorData,
  );
  const signers = esigResponse?.data?.esign?.data?.signers?.data;

  logger.debug({ ctx, esigRequestId, signers, envelopeId, requestorData }, 'getLeaseESignatureRequest signers');
  /*
      "id": "dd4cf47a0e42fd60dca22a20ed4a0b24",
      "name": "John Smith",
      "email": "resident1@mail.reva.tech",
      "phone": null,
      "started": false,
      "completed": false,
      "signature_url": "https:\\/\\/new.bluemoonforms.com\\/esignature\\/dd4cf47a0e42fd60dca22a20ed4a0b24",
      "identifier": "resident_1",
      "date_signed": null
    }
  */
  if (!signers) {
    throw new BluemoonApiError(ctx, 'Error while calling Bluemoon API: Did not receive signers data', revaLeaseId, esigRequestId, envelopeId);
  }

  const signerStatuses = convertSignerStatuses(ctx, signers);
  logger.debug({ ctx, esigRequestId, signerStatuses }, 'back from fetching signature stasuses');
  return signerStatuses;
};

const getAllESignatureStatuses = async (ctx, revaPropertyId) => {
  let pageNumber = 1;
  const url = pageNo => `/api/esignature/lease?page=${pageNo}`;
  const convertedSignatures = {};
  let retrieveNextPage = false;

  do {
    const esigStatusesResponse = await sendRequest(ctx, revaPropertyId, url(pageNumber));
    const eSignatureRequests = esigStatusesResponse?.data;
    if (!eSignatureRequests) {
      throw new BluemoonApiError(ctx, 'Error while calling Bluemoon API: getAllESignatureStatuses: Did not receive eSignatureRequests data', revaPropertyId);
    }

    eSignatureRequests.reduce((acc, eSigRequest) => {
      const bmLeaseId = eSigRequest.lease_id;
      const bmEsignId = eSigRequest.id;
      const createdAt = eSigRequest.created_at;
      const executed = eSigRequest.esign?.data?.executed;
      const expired = eSigRequest.esign?.data?.expired;
      const signers = eSigRequest.esign?.data?.signers?.data;

      if (!signers) {
        throw new BluemoonApiError(
          ctx,
          'Error while calling Bluemoon API: getAllESignatureStatuses: Did not receive eSignatureRequest data',
          revaPropertyId,
          bmLeaseId,
          bmEsignId,
        );
      }

      acc[bmLeaseId] = {
        ...acc[bmLeaseId],
        [bmEsignId]: { executed, expired, createdAt, signers: convertSignerStatuses(ctx, signers) },
      };
      return acc;
    }, convertedSignatures);

    pageNumber++;
    retrieveNextPage = !!esigStatusesResponse.meta?.pagination?.links?.next;
  } while (retrieveNextPage);

  logger.debug({ ctx, revaPropertyId }, 'getAllESignatureStatuses signers');
  return convertedSignatures;
};

const getAllLeases = async (ctx, revaPropertyId) => {
  let pageNumber = 1;
  const url = pageNo => `/api/lease?page=${pageNo}`;
  let retrieveNextPage = false;
  const allLeases = [];

  do {
    const leaseResponse = await sendRequest(ctx, revaPropertyId, url(pageNumber));
    const leaseData = leaseResponse?.data;
    if (!leaseData) {
      throw new BluemoonApiError(ctx, 'Error while calling Bluemoon API: getAllLeases: Did not receive lease data', revaPropertyId);
    }

    leaseData.forEach(lease =>
      allLeases.push({
        leaseId: lease.id.toString(),
        residents: lease.residents,
      }),
    );

    pageNumber++;
    retrieveNextPage = !!leaseResponse.meta?.pagination?.links?.next;
  } while (retrieveNextPage);

  return allLeases;
};

const executeLease = async (ctx, revaPropertyId, revaLeaseId, envelopeId, bmLeaseId, ownerName, ownerInitials, ownerTitle) => {
  const ownerDetails = {
    name: ownerName,
    initials: ownerInitials,
    title: ownerTitle,
  };
  const result = await sendPostRequest(
    ctx,
    revaPropertyId,
    `/api/esignature/lease/execute/${bmLeaseId}`,
    ownerDetails,
    revaLeaseId,
    envelopeId,
    'ExecuteLease',
    {
      clientUserId: 'CounterSigner1',
    },
  );
  return result;
};

const getFormSet = async (ctx, revaPropertyId, bmPropertyId) => {
  logger.info({ ctx, bmPropertyId, revaPropertyId }, 'getting formSet');
  assert(bmPropertyId, 'getFormSet: bmPropertyId not found');

  // These should be executed in parallel
  const { lease, application, other, notice_forms } = await sendRequest(ctx, revaPropertyId, `/api/forms/list/${bmPropertyId}`);
  const { data: customForms } = await sendRequest(ctx, revaPropertyId, `/api/forms/custom/${bmPropertyId}`);
  const { data: fields } = await sendRequest(ctx, revaPropertyId, `/api/lease/fields/${bmPropertyId}`);
  return { forms: { lease, application, other, notice: notice_forms, customForms }, fields };
};

// if filepath is set, content will be saved to that file.
// Regardless of set or not, binary content will be returned as byte array
// TODO: we should not do this since content may be large
// Using "image" for type because that seems to be the only way I can get SA to return raw data
const getPdf = async (ctx, revaPropertyId, revaLeaseId, envelopeId, esigRequestId, filePath) =>
  await sendRequest(
    ctx,
    revaPropertyId,
    `/api/esignature/lease/pdf/${esigRequestId}`,
    null,
    revaLeaseId,
    envelopeId,
    'GetPDF',
    {},
    { filePath, type: 'raw', alwaysReturnText: false },
  );

const client = {
  createLease,
  deleteLease,
  createLeaseESignatureRequest,
  deleteLeaseESignatureRequest,
  getLeaseESignatureRequest,
  getAllESignatureStatuses,
  getAllLeases,
  executeLease,
  getFormSet,
  getPdf,
};

export default client;
