/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as dal from '../dal/common-user-repo';
import { makeTokenInvalid } from '../dal/common-tokens-repo';
import * as personDal from '../../../server/dal/personRepo';
import { getTenant, getTenantByName } from '../../../server/services/tenantService';
import { errorIfHasUndefinedValues, badRequestErrorIfNotAvailable } from '../../../common/helpers/validators';
import { createJWTToken, tryDecodeJWTToken } from '../../../common/server/jwt-helpers';
import { BadRequestError, ServiceError } from '../../../server/common/errors';
import { commonSchema } from '../../../common/helpers/database';
import { AppLinkIdUrls } from '../../../common/enums/messageTypes';
import { DALTypes, ApplicationNames, ApplicationEmailTexts } from '../../common/enums/dal-types';
import { formatPropertyAddress } from '../../../common/helpers/utils';
import { enhanceAppConfigFromPersonMapping } from '../../../common/helpers/auth';
import logger from '../../../common/helpers/logger';
import authConfig from '../../config';
import { commonUserSignIn } from './common-user-helpers';
import { getTenantData } from '../../../server/dal/tenantsRepo';

export const createCommonUser = async (ctx, args) => {
  const { personId, email, applicationId } = args;
  const { tenantId } = ctx;
  badRequestErrorIfNotAvailable([{ property: tenantId, message: 'MISSING_TENANT_ID' }]);
  if (!personId && !email) {
    throw new BadRequestError('MISSING_PERSON_ID_OR_EMAIL_ADDRESS');
  }
  const person = personId ? await personDal.getPersonById(ctx, personId) : await personDal.getPersonByEmailAddress(args, email);
  const rawUser = {
    fullName: person.fullName,
    preferredName: person.preferredName,
    email: person.contactInfo.defaultEmail,
    metadata: {
      applicationId,
    },
  };
  return await dal.createCommonUser(ctx, person.id, rawUser);
};

export const createCommonUsersByPersonIds = async (ctx, personIds) => await dal.createCommonUsersByPersonIds(ctx, personIds);

export const getCommonUser = (ctx, commonUserId) => dal.getCommonUser(ctx, commonUserId);

export const getCommonUserByAnonymousEmailId = (ctx, anonymousEmailId) => dal.getCommonUserByAnonymousEmailId(ctx, anonymousEmailId);

export const getCommonUserByPersonId = (ctx, personId) => dal.getCommonUserByPersonId(ctx, personId);

export const getCommonUserByPersonIds = (ctx, personIds) => dal.getCommonUserByPersonIds(ctx, personIds);

export const getCommonUsersByCommonUserId = async (ctx, commonUserId) => await dal.getCommonUsersByCommonUserId(ctx, commonUserId);

export const getCommonUserByEmailAddress = (ctx, emailAddress) => dal.getCommonUserByEmailAddress(ctx, emailAddress);

// TODO: pass in ctx
export const createCommonUserFromEmail = async (propertyConfig, emailAddress) => {
  const { tenantId, tenantName, applicationId, propertyId, propertyName } = propertyConfig;
  const ctx = { tenantId };

  const person = await personDal.createPerson(
    { tenantId },
    {
      fullName: '',
      preferredName: '',
      contactInfo: {
        all: [{ type: 'email', value: emailAddress.toLowerCase() }],
      },
    },
  );

  const propsConfig = {
    id: propertyId,
    name: propertyName,
    tenant: { id: tenantId, name: tenantName },
  };
  const commonUser = {
    fullName: person.fullName,
    preferredName: person.preferredName,
    email: person.contactInfo.defaultEmail,
    metadata: {
      applicationId,
    },
    roommateProfile: { properties: [propsConfig] },
  };

  return dal.createCommonUser(ctx, person.id, commonUser);
};

export const commonUserChangePassword = async (ctx, userId, password) => {
  await dal.commonUserChangePassword(ctx, userId, password);
  await makeTokenInvalid(ctx, userId);
};

export const changeCommonUserPassword = async (ctx, { email, password, emailToken }) => {
  const { result = {}, successful } = tryDecodeJWTToken(emailToken, null, {
    jwtConfigKeyName: 'resident.emailJwtSecret',
    encryptionConfigKeyName: 'resident.emailEncryptionKey',
  });

  if (!successful) {
    throw new ServiceError({ token: 'INVALID_TOKEN', status: 498 });
  }

  const { commonUserId } = result;
  const commonUser = await dal.getCommonUserByIdAndEmail(ctx, commonUserId, email);

  if (!commonUser) {
    logger.error({ ctx, email, commonUserId }, 'Common user not found');
    throw new ServiceError({ token: 'USER_NOT_FOUND', status: 404 });
  }

  const [updatedCommonUser] = await dal.commonUserChangePassword(ctx, commonUserId, password);

  return {
    ...(updatedCommonUser || {}),
  };
};

export const getPersonIdByTenantIdAndUserId = (ctx, tenantId, commonUserId) => dal.getPersonIdByTenantIdAndUserId(ctx, tenantId, commonUserId);

export const getEmailAddressByUserId = (ctx, userId) => dal.getEmailAddressByUserId(ctx, userId);

export const getPersonMappingByTenantIdAndUserId = async (ctx, tenantId, userId) => {
  logger.trace({ ctx, userId }, 'getPersonMappingByTenantIdAndUserId');
  errorIfHasUndefinedValues({ tenantId, userId });
  const personId = await getPersonIdByTenantIdAndUserId(ctx, tenantId, userId);
  logger.trace({ ctx, userId, personId }, 'getPersonMappingByTenantIdAndUserId got mapping');
  return { tenantId, commonUserId: userId, personId };
};

export const formatConfirmUrlForResetPassword = (confirmUrl, appId, tenantName, propertyName) => {
  if (appId !== DALTypes.RoommatesAppId) return confirmUrl;

  const finalConfirmUrl = confirmUrl.replace(':tenantName', tenantName);
  return finalConfirmUrl.replace(':propertyName', propertyName);
};

export const getAppNameByAppId = appId => (appId === DALTypes.RoommatesAppId ? ApplicationNames.ROOMMATES : '');

// TODO: pass in ctx
export const getOrCreateCommonUserByEmail = async (propertyConfig, emailAddress) => {
  const { tenantId } = propertyConfig;
  const ctx = { tenantId };
  const existingCommonUser = await getCommonUserByEmailAddress(ctx, emailAddress);

  let commonUserResult;
  if (existingCommonUser) {
    const personId = await getPersonIdByTenantIdAndUserId(ctx, tenantId, existingCommonUser.id);
    commonUserResult = { commonUser: existingCommonUser };
    commonUserResult.personMapping = {
      tenantId,
      commonUserId: existingCommonUser.id,
      personId,
    };
  } else {
    commonUserResult = await createCommonUserFromEmail(propertyConfig, emailAddress);
  }
  return commonUserResult;
};

export const isProfileCompletedInRoommatesApp = (commonUser, roommateProfileRequiredFields) => {
  if (commonUser.metadata.applicationId !== DALTypes.RoommatesAppId) {
    return false;
  }
  const isAnyIncomplete = roommateProfileRequiredFields.some(
    key => commonUser.roommateProfile[key] === null || commonUser.roommateProfile[key] === undefined || commonUser.roommateProfile[key] === '',
  );
  return !isAnyIncomplete;
};

export const authenticateCommonUser = async (ctx, emailAddress, password) => {
  const matchingUser = await commonUserSignIn(ctx, { email: emailAddress, password }, authConfig.auth);

  return {
    email: matchingUser.email,
    fullName: matchingUser.fullName,
    preferredName: matchingUser.preferredName,
    id: matchingUser.id,
    metadata: matchingUser.metadata,
    roommateProfile: matchingUser.roommateProfile,
  };
};

// TODO: use ctx
export const getRegistrationToken = async (ctx, { id, email, metadata: { applicationId } }, applicant) => {
  const { partyId, quoteId, propertyId, personId, hasMultipleApplications, ...applicantProps } = applicant;
  const { tenantId } = ctx;
  logger.trace({ ctx, partyId, quoteId, propertyId, personId }, 'getRegistrationToken');
  // quoteId is NOT required
  errorIfHasUndefinedValues({ tenantId, id, partyId, propertyId, personId, applicationId, email });
  const [person, personMapping, tenant] = await Promise.all([
    personDal.getPersonById(ctx, personId),
    getPersonMappingByTenantIdAndUserId(ctx, tenantId, id),
    getTenantData(ctx),
  ]);
  logger.trace({ ctx, person, personMapping }, 'getRegistrationToken got data');

  const tokenOptions = { expiresIn: authConfig.registrationTokenExpires };
  return createJWTToken(
    {
      appId: DALTypes.ApplicationAppId,
      partyId,
      propertyId,
      quoteId,
      applicationId,
      applicant: applicantProps,
      emailAddress: email,
      name: person.preferredName,
      tenantId,
      tenantName: tenant.name,
      userId: id,
      personMapping,
      personId: personMapping.personId,
      hasMultipleApplications,
      settings: {
        communications: {
          disclaimerLink: tenant.settings.communications.disclaimerLink,
          contactUsLink: tenant.settings.communications.contactUsLink,
        },
      },
    },
    tokenOptions,
  );
};

export const getAppDataForEmailByAppId = (appId, tenant, appContext = {}, property = {}) => {
  switch (appId) {
    case DALTypes.RoommatesAppId:
      return {
        appName: ApplicationNames.ROOMMATES,
        shortAppName: ApplicationNames.ROOMMATES_SHORTNAME,
        contactUsLink: AppLinkIdUrls.CONTACT_US_ID,
        footerNotice: ApplicationEmailTexts.ROOMMATES_FOOTER_NOTICE,
      };
    case DALTypes.ApplicationAppId: {
      const { communications = {} } = appContext.settings || {};
      return {
        appName: property.displayName,
        propertyAddress: formatPropertyAddress(property),
        contactUsLink: communications.contactUsLink,
        footerNotice: tenant.settings.communications.footerNotice,
      };
    }
    default:
      return {};
  }
};

// TODO: CPM-7383 we should remove the reference to rentapp
const parseAppConfig = (appId, appContext = {}, propertyId) => {
  if (appId !== DALTypes.ApplicationAppId) return undefined;

  const { settings, partyId, quoteId, applicant, personMapping, name } = appContext;
  const { tenantId, personId, commonUserId } = personMapping || {};
  const { personApplicationId, tenantDomain } = applicant || {};

  if (settings && settings.appConfig) return enhanceAppConfigFromPersonMapping(settings.appConfig, personMapping);

  return {
    tenantId,
    personId,
    partyId,
    quoteId,
    tenantDomain,
    personApplicationId,
    commonUserId: commonUserId || appContext.userId,
    personName: name,
    propertyId,
  };
};

const getTenantAndPropertyInformation = async (commonUser, appId, appContext = {}) => {
  switch (appId) {
    case DALTypes.RoommatesAppId: {
      // For now, always it gets the first property name associated to the user
      const [property] = commonUser.roommateProfile.properties;
      return { property, tenant: property.tenant };
    }
    case DALTypes.ApplicationAppId: {
      const { partyId, quoteId, personMapping, propertyId } = appContext;
      const { tenantId } = personMapping || {};

      const tenant = await getTenant({ tenantId });
      // eslint-disable-next-line global-require
      const { getPropertyForRegistration } = require('../../../server/helpers/party');
      // TODO: CPM-7383 we should always pass a propertyId to auth
      const property = await getPropertyForRegistration({ tenantId }, { partyId, propertyId, quoteId });
      return { tenant, property };
    }
    default:
      return {};
  }
};

export const getParametersToSendEmail = async (ctx, commonUser, host, protocol, appId, appContext = {}) => {
  const { tenant, property } = await getTenantAndPropertyInformation(commonUser, appId, appContext);

  const personMapping = await getPersonMappingByTenantIdAndUserId(ctx, tenant.id, commonUser.id);
  const { appName, shortAppName, contactUsLink, footerNotice, propertyAddress } = getAppDataForEmailByAppId(appId, tenant, appContext, property);

  const emailContext = {
    appId,
    appConfig: parseAppConfig(appId, appContext, property.id),
    tenantId: tenant.id,
    tenantName: tenant.name,
    propertyName: property.name,
    propertyId: property.id,
    propertyAddress,
    appName,
    shortAppName,
    contactUsLink,
    footerNotice,
    host,
    protocol,
  };

  return { emailContext, personMapping };
};

export const getTenantResidentSettings = async (ctx, { appId, commonUserId, tenantName, propertyId }) => {
  logger.info({ ctx, appId, commonUserId, tenantName, propertyId }, 'getTenantResidentSettingsByAppId started!');

  const tenantId = tenantName ? ((await getTenantByName(tenantName)) || {}).id : undefined;
  const residentSettings = await dal.getTenantResidentSettingsByAppId(ctx, { appId, commonUserId, tenantId, propertyId }); // For now we will use the tenantId only

  return residentSettings || { tenantId: commonSchema };
};
