/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantData } from '../dal/tenantsRepo';
import { request } from '../../common/helpers/httpUtils';
import { capitalizeWords } from '../../common/regex';
import config from '../config';
import cucumberConfig from '../../cucumber/config';
import logger from '../../common/helpers/logger';

const { cucumber } = cucumberConfig;
const twilioLookupBaseUrl = 'lookups.twilio.com/v1/PhoneNumbers/';

const formatCallerName = name => {
  if (!name) return '';

  if (!name.includes(',')) return name;

  const nameArray = name.split(',').map(value => value.trim());

  if (nameArray.length === 1) return nameArray[0];

  if (nameArray.length === 2) {
    if (nameArray.find(value => value.length < 3)) return nameArray.join(' ');
    return nameArray.reverse().join(' ');
  }

  return nameArray.join(' ');
};

export const parseResult = response => ({
  callerName: capitalizeWords(formatCallerName((response.caller_name || {}).caller_name)).trim(),
  type: (response.carrier || {}).type,
});

const getParameters = parameters => {
  let result = '';
  // TODO: This is temporary until we figure out why sometimes caller-name is not reuqested when it should: CPM-19748
  parameters.callerName = true;
  if (parameters.callerName) result = 'Type=caller-name';
  if (parameters.carrier) result = parameters.callerName ? `${result}&Type=carrier` : 'Type=carrier';
  return result;
};

export const getPhoneNumberInfo = (parameters, phoneNumber) => {
  const urlParameters = getParameters(parameters);
  const authId = config.telephony.twilioAuth.authId;
  const authToken = config.telephony.twilioAuth.authToken;
  const twilioLookupUrl = `https://${authId}:${authToken}@${twilioLookupBaseUrl}`;
  const url = `${twilioLookupUrl}${phoneNumber}?${urlParameters}`;
  return request(url, { timeout: 3000 });
};

const twilioFakeProviderOps = {
  getPhoneNumberInfo: () => ({}),
};

let twilioProviderOps = {
  getPhoneNumberInfo,
};

export const getTwilioProviderOps = phoneSupportEnabled => (phoneSupportEnabled ? twilioProviderOps : twilioFakeProviderOps);
export const setTwilioProviderOps = s => {
  twilioProviderOps = s;
};
export const resetTwilioProviderOps = () => {
  twilioProviderOps = { getPhoneNumberInfo };
};

export const isPhoneUsedByCucumber = tenantName => tenantName === cucumber.tenantName;
export const phoneSupportEnabled = tenant => tenant.metadata && tenant.metadata.enablePhoneSupport && !isPhoneUsedByCucumber(tenant.name);

export const getPhoneNumberSMSInfo = async (ctx, phoneNumber) => {
  const tenant = await getTenantData(ctx);
  try {
    const serviceCallResult = await getTwilioProviderOps(phoneSupportEnabled(tenant)).getPhoneNumberInfo({ carrier: true }, phoneNumber);
    logger.trace({ ctx, serviceCallResult, phoneNumber }, 'Twilio service call result');
    const enhancedData = parseResult(serviceCallResult);

    return {
      smsEnabled: enhancedData.type ? enhancedData.type === 'voip' || enhancedData.type === 'mobile' : true,
      serviceCallResult,
    };
  } catch (ex) {
    const error = {
      message: ex.message,
      token: ex.token,
      stack: ex.stack,
      response: ex.response,
    };
    logger.warn({ ctx, phoneNumber, error }, 'Error while retrieving twilio data');
    return { smsEnabled: true, serviceCallResult: { error } }; // ssnEmabled: true due to this CPM-16858
  }
};
