/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js-es6-promise';
import config from '../../config';
import { request } from '../../../common/helpers/httpUtils';
import loggerModule from '../../../common/helpers/logger';
import { saveMRIExportTracking, updateMRIExportTracking } from './mri-export-utils';
import { ApiProviders, getAuthorizationToken, getQueryParamsString, getMriEndPoint } from '../../helpers/mriIntegration';

const logger = loggerModule.child({ subType: 'export/mri' });

const MRI_API_SUCCESS = 'Success';

const getResultFromMriApiResponse = response => {
  const rootResponseObject = Object.values(response);
  if (rootResponseObject && rootResponseObject.length === 1) {
    const rootValue = rootResponseObject[0];
    if ('Result' in rootValue) {
      if (rootValue.Result && rootValue.Result.length) {
        return rootValue.Result[0];
      }
    }
  }

  return ''; // If the response does not contain a Result tag, or it is empty, we consider there is no error.
};

const isMriApiResultSuccessful = result => result === '' || (result && result.includes(MRI_API_SUCCESS));

const extractEntryFromResponse = (ctx, response, { apiProvider, apiType }) => {
  switch (apiProvider) {
    case ApiProviders.MRI_S: {
      const { entry } = response[apiType.toLowerCase()];
      return entry && entry.length ? entry[0] : response;
    }
    case ApiProviders.MRI_API: {
      return response;
    }
    default: {
      logger.error({ ctx, apiProvider, apiType }, 'Invalid api provider');
      throw new Error(`Invalid api provider: ${apiProvider}`);
    }
  }
};

const defaultPostXML = async (ctx, { url, xml, options, trackingId }) => {
  let response;
  try {
    response = await request(url, {
      method: 'post',
      type: 'text/xml',
      data: xml,
      buffer: true,
      alwaysReturnText: true,
      ...options,
    });
  } catch (error) {
    const reqError = error.response && error.response.error;
    logger.error({ ctx, url, xml, options, trackingId, reqError, error }, 'Error posting XML to MRI');
    await updateMRIExportTracking(ctx, { id: trackingId, response: error });
    throw error;
  }

  await updateMRIExportTracking(ctx, { id: trackingId, response });

  return response;
};

export const defaultGetFromMri = async (ctx, api, queryParams, partyId) => {
  let url = `${config.mri.mri_s.apiUrl}?$api=${api}&$format=xml`;

  const paramString = getQueryParamsString(queryParams);
  url += paramString ? `&${paramString}` : '';

  const requestData = {
    method: 'get',
    buffer: true,
    alwaysReturnText: true,
    headers: {
      Authorization: getAuthorizationToken({ apiProvider: ApiProviders.MRI_S }),
      'Content-Type': 'application/xml',
    },
    timeout: config.mri.requestTimeout,
  };

  const exportTrackingRecord = { partyId, url, api, request: requestData };
  const { id } = await saveMRIExportTracking(ctx, exportTrackingRecord);

  const shouldIgnore = error => {
    if (!error.response || !error.response.text) return false;

    const { text } = error.response;
    return text.indexOf('RESIDENTID: The specified resident does not have any pets.') >= 0;
  };

  let result;
  try {
    result = await request(url, requestData);
  } catch (error) {
    await updateMRIExportTracking(ctx, { id, response: error });

    if (!shouldIgnore(error)) {
      logger.error({ ctx, error, exportTrackingId: id }, 'Error on GET from MRI');
      throw error;
    }

    logger.trace({ ctx, error, exportTrackingId: id }, 'Ignored error on GET from MRI');
  }

  await updateMRIExportTracking(ctx, { id, response: result });

  if (!result) return result;

  return await xml2js(result);
};

let postXML = defaultPostXML;
let getXML = defaultGetFromMri;

export const setPostXMLFunc = func => {
  postXML = func;
};

export const setGetXMLFunc = func => {
  getXML = func;
};

export const getFromMri = (ctx, api, queryParams, partyId) => getXML(ctx, api, queryParams, partyId);

const getError = entry => {
  if (entry.Error && entry.Error.length) return entry.Error;
  return entry.ProspectiveTenant && entry.ProspectiveTenant[0].entry[0].Error;
};

export const postFile = async (ctx, xml, options) => {
  options.apiProvider = options.apiProvider || ApiProviders.MRI_S;
  options.queryParams = { ...options.queryParams, $format: 'xml' };

  const { url, method } = getMriEndPoint(options);

  logger.trace({ ctx, url, xml, method }, 'Posting XML to MRI');

  const { partyId } = options;

  const authorization = getAuthorizationToken(options);
  const reqInfo = {
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/xml',
    },
    timeout: config.mri.requestTimeout,
    method,
  };
  const exportTrackingRecord = { partyId, url, api: options.apiType, request: reqInfo, requestBody: xml };
  const { id } = await saveMRIExportTracking(ctx, exportTrackingRecord);

  const xmlResponse = await postXML(ctx, { url, xml, options: reqInfo, trackingId: id });

  logger.trace({ ctx, xmlResponse }, 'Received XML response from MRI');
  const result = await xml2js(xmlResponse);

  logger.trace({ ctx, mriResult: result }, 'Post XML to MRI result');
  const entry = extractEntryFromResponse(ctx, result, options);
  const error = getError(entry);

  if (error && error.length) {
    const msg = error.map(e => e.Message).join('\n');
    throw new Error(msg);
  }

  if (options.apiProvider === ApiProviders.MRI_API) {
    const resultValue = getResultFromMriApiResponse(entry);
    if (!isMriApiResultSuccessful(resultValue)) {
      throw new Error(resultValue);
    }
  }

  return entry;
};

export const isPrimaryTenantAResidentInMRI = async (ctx, data) => {
  logger.info({ ctx, primaryTenant: data.primaryTenant, externals: data.externals }, 'Verifying if the primary tenant is a resident in MRI');

  const getApi = 'MRI_S-PMRM_Residents';
  const primaryTenant = data.externals.find(pm => pm.isPrimary);

  if (!primaryTenant || (primaryTenant && primaryTenant.externalId === null)) {
    return false;
  }

  const response = primaryTenant && (await getFromMri(ctx, getApi, { NameId: primaryTenant.externalId }, data.party.id));
  const resident = extractEntryFromResponse(ctx, response, { apiProvider: ApiProviders.MRI_S, apiType: getApi });

  return resident.ProspectApplicantResident[0] === 'R';
};
