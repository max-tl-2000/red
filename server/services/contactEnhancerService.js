/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { getTenantData } from '../dal/tenantsRepo';
import { getTwilioProviderOps, phoneSupportEnabled, parseResult } from '../common/twillioHelper';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'contactEnhancerService' });
import { updatePerson } from '../dal/personRepo';

const constructContactInfoDelta = (person, contactInfo, contactInfoId, serviceCallResult, smsEnabled) =>
  enhance([
    {
      ...contactInfo,
      metadata: { thirdPartyCallResult: serviceCallResult, sms: smsEnabled },
    },
    ...person.contactInfo.all.filter(p => p.id !== contactInfoId),
  ]);

const getThirdPartyPhoneNumberInfo = async (ctx, contactInfo, callParams, phoneNumber) => {
  const { thirdPartyCallResult } = contactInfo.metadata;

  if (thirdPartyCallResult) return { serviceCallResult: thirdPartyCallResult };

  const tenant = await getTenantData(ctx);

  try {
    const serviceCallResult = await getTwilioProviderOps(phoneSupportEnabled(tenant)).getPhoneNumberInfo(callParams, phoneNumber);
    logger.trace({ ctx, serviceCallResult, callParams, phoneNumber }, 'Twilio service call result');
    return { serviceCallResult, contactInfoNeedsUpdate: true };
  } catch (ex) {
    const error = {
      message: ex.message,
      token: ex.token,
      stack: ex.stack,
      response: ex.response,
    };

    logger.error({ ctx, error }, `Error while tring to get additional contact information for number: ${phoneNumber}`);
    return { serviceCallResult: { error } };
  }
};

export const enhanceContactWithThirdPartyInfo = async (ctx, person, callParams, phoneNumber) => {
  logger.trace({ ctx, person, callParams, phoneNumber }, 'enhanceContactWithThirdPartyInfo');
  const contactInfo = person.contactInfo.all.find(ci => ci.value === phoneNumber);
  if (!contactInfo) {
    logger.trace({ ctx, person, callParams, phoneNumber }, 'enhanceContactWithThirdPartyInfo: skipping enhancement as no contactInfo available');
    return person;
  }

  const { serviceCallResult, contactInfoNeedsUpdate } = await getThirdPartyPhoneNumberInfo(ctx, contactInfo, callParams, phoneNumber);
  if (!serviceCallResult) return person;

  const { callerName, type } = parseResult(serviceCallResult);
  const smsEnabled = !!type && (type === 'voip' || type === 'mobile');
  const contactInfoDelta = constructContactInfoDelta(person, contactInfo, contactInfo.id, serviceCallResult, smsEnabled);

  const canUpdateFullName = !person.fullName || !/[a-z]/i.test(person.fullName);
  const shouldUpdateName = canUpdateFullName && !!callerName;

  const delta = {
    ...(contactInfoNeedsUpdate ? { contactInfo: contactInfoDelta } : {}),
    ...(shouldUpdateName ? { fullName: callerName, preferredName: callerName.split(' ')[0] } : {}),
  };

  return isEmpty(delta) ? person : await updatePerson(ctx, person.id, delta);
};
