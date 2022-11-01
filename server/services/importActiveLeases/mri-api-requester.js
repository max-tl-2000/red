/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { ApiProviders, getAuthorizationToken, getMriEndPoint } from '../../helpers/mriIntegration';
import { request } from '../../../common/helpers/httpUtils';
import config from '../../config';

const logger = loggerModule.child({ subType: 'importActiveLeases - MRI' });

export const RetrieveActiveLeaseData = 'RetrieveActiveLeaseData';
export const LastUpdateInitialDate = '2015-01-01';

const doRequest = async (ctx, { api, method, body, queryParams = {} }) => {
  queryParams.$format = 'json';
  const { url } = await getMriEndPoint({ apiProvider: ApiProviders.MRI_API, apiType: api, queryParams });

  const requestData = {
    method,
    type: 'json',
    buffer: true,
    data: body,
    alwaysReturnText: true,
    headers: {
      Authorization: getAuthorizationToken({ apiProvider: ApiProviders.MRI_API }),
      Accept: 'application/json',
    },
    timeout: config.mri.requestTimeout,
  };

  logger.trace({ ctx, url, method }, 'Sending request to MRI');
  let result;
  try {
    result = await request(url, requestData);
  } catch (error) {
    logger.error({ ctx, method, body, queryParams, url, requestData, responseText: error.response?.text, error }, 'MRI request error');
    throw error;
  }

  logger.trace({ ctx, url, method }, 'Received response from MRI');

  return result;
};

// sample data here: server/workers/__integration__/resources/mri-import/test-data.js
const getData = async ({ ctx, propertyExternalId, primaryExternalId }) => {
  logger.trace({ ctx, propertyExternalId, primaryExternalId }, 'mri-api-requester - getData - start');
  const queryParams = {
    propertyExternalId,
    ...(primaryExternalId && { primaryResidentId: primaryExternalId }),
  };

  const unparsedData = await doRequest(ctx, {
    api: RetrieveActiveLeaseData,
    method: 'get',
    queryParams,
  });

  const parsedData = JSON.parse(unparsedData);
  logger.trace({ ctx, propertyExternalId, primaryExternalId, entries: parsedData.length }, 'mri-api-requester - getData - done');
  return parsedData;
};

let _default = getData;
export const setGetMriActiveLeaseData = func => (_default = func);
export const getMriActiveLeaseData = params => _default(params);
