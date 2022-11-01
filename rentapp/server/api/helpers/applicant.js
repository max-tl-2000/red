/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { getPersonApplicationToken } from '../../services/person-application';
import { getCommonUserByPersonId, getRegistrationToken } from '../../../../auth/server/services/common-user';
import { Routes } from '../../../common/enums/rentapp-types';
import { resolveSubdomainURL } from '../../../../common/helpers/resolve-url';
import { getPersonById } from '../../../../server/services/person';
import { enhanceAppConfigFromPersonMapping } from '../../../../common/helpers/auth';
import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'helperApplication' });
import { personApplicationProvider } from '../../providers/person-application-provider-integration';

export const getApplicantRegistrationToken = async (req, options = {}) => {
  const { tenantId, tenantDomain, quoteId, partyId, propertyId, personId, personApplicationId, screeningVersion } = options;
  const ctx = { ...req, tenantId };
  const isApplicationPaid = await personApplicationProvider(screeningVersion).hasPaidApplication(req, personId, partyId);

  const commonUser = await getCommonUserByPersonId(ctx, personId);
  if (!(isApplicationPaid && commonUser)) return undefined;

  const applicantData = {
    partyId,
    quoteId,
    personApplicationId,
    propertyId,
    personId,
    tenantDomain,
  };

  return await getRegistrationToken(ctx, commonUser, applicantData);
};

export const getApplicationUrl = async (req, data) => {
  logger.debug({ ctx: req }, 'getApplicationUrl');
  const ctx = req;
  const { userId, personMapping, appId, hasMultipleApplications } = data;
  ctx.tenantId = personMapping.tenantId;

  const { appConfig } = data.settings || {};
  let { applicant, quoteId, partyId, propertyId } = data;
  if (appConfig) {
    partyId = appConfig.partyId;
    quoteId = appConfig.quoteId;
    propertyId = appConfig.propertyId;
    applicant = {
      personApplicationId: appConfig.personApplicationId,
      tenantDomain: appConfig.tenantDomain,
    };
  }

  const applicationTokenObject = {
    personId: personMapping.personId,
    quoteId,
    partyId,
    tenantId: personMapping.tenantId,
    personApplicationId: applicant.personApplicationId,
    propertyId,
    commonUserId: userId,
    tenantDomain: applicant.tenantDomain,
    hasMultipleApplications,
  };

  const applicationToken = await getPersonApplicationToken(ctx, applicationTokenObject);
  return resolveSubdomainURL(`${req.protocol}://${req.hostname}${Routes.additionalInfo}${applicationToken}`, appId);
};

// TODO: CPM-7383 - we need to get the applicant information in the cases we only have the personApplicationId
export const getApplicantData = async ({ authUser }) => {
  const { personMapping, applicant, settings } = authUser;
  if (settings && settings.appConfig) return enhanceAppConfigFromPersonMapping(settings.appConfig, personMapping);

  if (!(personMapping && applicant)) {
    const person = await getPersonById({ tenantId: authUser.tenantId }, authUser.personId);

    if (!(person && person.mergedWith)) return authUser;

    const mergedPerson = await getPersonById({ tenantId: authUser.tenantId }, person.mergedWith);

    return {
      ...authUser,
      personId: mergedPerson.id,
      personName: mergedPerson.preferredName,
    };
  }

  const { personId } = personMapping || {};
  return {
    quoteId: authUser.quoteId,
    partyId: authUser.partyId,
    propertyId: authUser.propertyId,
    personId,
    personName: authUser.name,
    tenantId: authUser.tenantId,
    tenantDomain: applicant.tenantDomain,
  };
};

export const formatApplicationObject = applicantData => {
  const applicantDataFields = [
    'id',
    'personId',
    'partyId',
    'partyApplicationId',
    'applicationData',
    'additionalData',
    'applicantId',
    'isFeeWaived',
    'paymentLink',
  ];
  const applicationDataFieldsToDelete = ['guarantors', 'invitedToApply', 'otherApplicants'];
  const applicantionDataFieldsNeededForIncompletedPayment = ['firstName', 'middleName', 'lastName'];
  const applicantDataToRemove = ['additionalData'];

  const { paymentCompleted, applicationData } = applicantData;
  const formatedApplicationData = omit(applicationData, applicationDataFieldsToDelete);
  applicantData.applicationData = formatedApplicationData;
  const applicantNeededData = pick(applicantData, applicantDataFields);
  if (paymentCompleted) {
    return applicantNeededData;
  }
  const applicationDataWithoutSensitiveContent = pick(formatedApplicationData, applicantionDataFieldsNeededForIncompletedPayment);
  const applicantDataStepOne = omit(applicantNeededData, applicantDataToRemove);
  applicantDataStepOne.applicationData = applicationDataWithoutSensitiveContent;

  return applicantDataStepOne;
};
