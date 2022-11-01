/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import config from '../../config';
import { sendXMLRequest } from './service-requestor';
import { getAddressStandardizationRequest, getCityStateLookupRequest } from './request-templates';
import { hasOwnProp } from '../../../common/helpers/objUtils';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'uspsService' });

const getUspsApiPath = ({ baseUrl, endpointPath }) => `${baseUrl}/${endpointPath}`;
const userIdRegex = /USERID=(\\"|")(.*)(\\"|")/gim;

const makeUspsRequest = async (ctx, inputData, { method, serviceName, createUspsRequest, metadata }) => {
  const { userId, addressInformationEnabled } = config.usps;
  if (!addressInformationEnabled) return null;

  const apiPath = getUspsApiPath(config.usps);
  const payload = await createUspsRequest(inputData, userId);
  const payloadToLog = payload && payload.replace(userIdRegex, '');
  logger.trace({ ctx, apiPath, method, payload: payloadToLog }, `Requesting ${serviceName}`);

  const { success, response, error: errorResponse } = await sendXMLRequest({ apiPath, method, payload });
  if (!success) {
    logger.error({ ctx, apiPath, method, payload: payloadToLog, metadata, errorResponse }, `USPS request error - ${serviceName}`);
    return null;
  }

  return response;
};

const parseUspsResponse = (ctx, response, { serviceName, getDataFromResponse, parseResponse, metadata }) => {
  if (!response) return null;
  logger.trace({ ctx, uspsResponse: response }, `Parsing ${serviceName}`);

  const data = getDataFromResponse(response);
  const isUspsResponseValid = !hasOwnProp(data, 'Error');
  !isUspsResponseValid && logger.error({ ctx, errorResponse: data, metadata }, `USPS reported a problem - ${serviceName}`);

  return parseResponse(data);
};

export const getStandardizedAddress = async (ctx, applicationAddress, metadata = {}) => {
  const serviceName = 'Address Standardization';
  const addressResponse = await makeUspsRequest(ctx, applicationAddress, {
    serviceName,
    method: 'Verify',
    metadata,
    createUspsRequest: getAddressStandardizationRequest,
  });

  return parseUspsResponse(ctx, addressResponse, {
    serviceName,
    metadata,
    getDataFromResponse: ({ AddressValidateResponse } = {}) => (AddressValidateResponse && AddressValidateResponse.Address) || {},
    parseResponse: standardizedAddress => {
      if (standardizedAddress.Error) {
        return {
          error: {
            token: 'ADDRESS_STANDARDIZATION_ERROR',
            data: {
              error: {
                number: standardizedAddress.Error.Number,
                source: standardizedAddress.Error.Source,
                description: standardizedAddress.Error.Description,
              },
            },
          },
        };
      }

      const { Zip5, Zip4 } = standardizedAddress;
      // The usps use the address2 as primary address field and the address1 is not mandatory.
      // And we use in the other way around in reva
      return {
        addressLine1: standardizedAddress.Address2,
        addressLine2: standardizedAddress.Address1,
        city: standardizedAddress.City,
        state: standardizedAddress.State,
        zip: [Zip5, Zip4].filter(zip => zip).join('-'),
      };
    },
  });
};

export const getLocalitiesByZipCode = async (ctx, zipCode, metadata = {}) => {
  const serviceName = 'City State Lookup';
  const cityStateLookupResponse = await makeUspsRequest(ctx, zipCode, {
    serviceName,
    method: 'CityStateLookup',
    createUspsRequest: getCityStateLookupRequest,
    metadata,
  });

  return parseUspsResponse(ctx, cityStateLookupResponse, {
    serviceName,
    getDataFromResponse: ({ CityStateLookupResponse } = {}) => (CityStateLookupResponse && CityStateLookupResponse.ZipCode) || {},
    parseResponse: locality => ({
      zip5: locality.Zip5,
      city: locality.City,
      state: locality.State,
    }),
  });
};
