/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { decodeJWTToken, createJWTToken } from '../../../common/server/jwt-helpers';
import { errorIfHasUndefinedValues } from '../../../common/helpers/validators';
import { getPartyApplicationByPartyId } from '../services/party-application';
import { Routes } from '../../common/enums/rentapp-types';
import { getApplicantRegistrationToken } from './helpers/applicant';
import { getPartyPropertyLockData } from './helpers/party-property-lock';
import { getPersonById } from '../../../server/services/person';
import { getTenant } from '../../../server/services/tenantService';
import { getReplacedPropertyId } from '../../../server/services/properties';
import { loadPartyById, isCorporateLeaseType, getPartyMembersByPersonId } from '../../../server/services/party';
import { getCommonUserByPersonIds } from '../../../auth/server/services/common-user';
import { getLastMergeWithByPersonId } from '../../../server/dal/personRepo';
import { addTokenToUrls } from '../../../server/helpers/urlShortener';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'rentappMiddleware' });
import { getScreeningVersion } from '../helpers/screening-helper';
import { personApplicationProvider } from '../providers/person-application-provider-integration';

export const getApplicationToken = async (req, res) => {
  try {
    const { params } = req;
    if (!(params && params.rentappToken)) return undefined;
    const token = await decodeJWTToken(params.rentappToken);
    const { tenantId, ...rest } = token;

    req.tenantId = tenantId;

    const tenant = await getTenant(req);
    let propertyId = token.propertyId;
    if (tenantId !== tenant.id) {
      logger.warn({ ctx: req, newTenantId: tenant.id, oldTenantId: tenantId, oldPropertyId: propertyId }, 'replacing tenantId after merge');
      if (propertyId) {
        const replacedPropertyId = await getReplacedPropertyId({ tenantId: tenant.id }, propertyId);
        logger.warn(
          { ctx: req, newTenantId: tenant.id, oldTenantId: tenantId, oldPropertyId: propertyId, replacedPropertyId },
          'replaced propertyId after merge',
        );
        propertyId = replacedPropertyId;
      }
    }
    req.tenantId = tenant.id;
    const updatedToken = { ...rest, tenantId: tenant.id };
    return propertyId ? { ...updatedToken, propertyId } : updatedToken;
  } catch (err) {
    res.redirect(301, '/notFound');
  }
  return false;
};

export const decodeRentappTokenMiddleware = async (req, res, next) => {
  const { params: { rentappToken } = {} } = req;

  if (!rentappToken) {
    next();
    return;
  }

  const token = await decodeJWTToken(rentappToken);
  if (token) {
    req._decodedToken = token;
  }

  next();
};

export const detectMultipleApplications = async (req, res, next) => {
  logger.debug({ ctx: req }, 'detectMultipleApplications');
  const token = await getApplicationToken(req, res);
  if (!token || token.isNewApplicationRequest || token.impersonatorUserId) {
    next();
    return;
  }

  const { tenantId, partyId, personId } = token;
  errorIfHasUndefinedValues({ tenantId, partyId, personId });
  const ctx = req;

  const screeningVersion = await getScreeningVersion({ tenantId, partyId });

  const commonUsers = await getCommonUserByPersonIds(ctx, [personId]);

  const applicationsByPersonId = await personApplicationProvider(screeningVersion).getPersonApplicationsFromCommonUsers(commonUsers);
  const existsApplicationForGivenPartyAndPerson = applicationsByPersonId.filter(
    app => app.personId === personId && app.partyId === partyId && app.paymentCompleted === false,
  );

  if (!applicationsByPersonId.length || applicationsByPersonId.length === 1 || existsApplicationForGivenPartyAndPerson.length <= 1) {
    next();
    return;
  }

  logger.debug({ ctx: req }, 'detectMultipleApplications redirecting to applicationList');

  const applicationToken = createJWTToken({
    ...token,
    commonUserId: commonUsers[0].id,
    hasMultipleApplications: true,
  });
  const applicationUrl = `${req.protocol}://${req.hostname}${Routes.applicationList}${applicationToken}`;
  res.redirect(302, applicationUrl);
};

export const detectCommonUserHandler = async (req, res, next) => {
  logger.debug({ ctx: req }, 'detectCommonUserHandler');
  const token = await getApplicationToken(req, res);
  if (!token || token.impersonatorUserId) {
    next();
    return;
  }
  const { tenantId, tenantDomain, partyId, quoteId, propertyId } = token;
  const screeningVersion = await getScreeningVersion({ tenantId, partyId });

  const ctx = req;
  let { personId, personApplicationId } = token;

  logger.trace({ ctx }, 'detectCommonUserHandler getting person');
  const person = await getPersonById({ tenantId }, personId);

  if (person.mergedWith) {
    personId = person.mergedWith;
  }

  errorIfHasUndefinedValues({ tenantId, partyId, personId });

  logger.trace({ ctx, partyId, personId }, 'detectCommonUserHandler getting party');
  const partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  if (!partyApplication) {
    logger.warn({ ctx, partyId, personId }, 'detectCommonUserHandler no party application found');
    next();
    return;
  }

  logger.trace({ ctx }, 'detectCommonUserHandler getting application');
  const personApplication = await personApplicationProvider(screeningVersion).getPersonApplication(ctx, personId, partyApplication.id);

  if (!personApplication) {
    logger.warn({ ctx, partyId, personId }, 'detectCommonUserHandler no person application found');
    next();
    return;
  }
  if (!personApplicationId) personApplicationId = personApplication.id;

  logger.trace({ ctx, quoteId, partyId, personId, propertyId, personApplicationId }, 'detectCommonUserHandler getting registration token');
  const registrationToken = await getApplicantRegistrationToken(ctx, {
    tenantId,
    tenantDomain,
    quoteId,
    partyId,
    personId,
    propertyId,
    personApplicationId,
    screeningVersion,
  });
  const { paymentCompleted } = personApplication; // TODO: we need to add this to applicant data not committed

  if (!(registrationToken && paymentCompleted)) {
    logger.trace({ ctx, quoteId, partyId, personId, propertyId, personApplicationId, paymentCompleted }, 'detectCommonUserHandler passing through...');
    next();
    return;
  }

  logger.trace({ ctx }, 'detectCommonUserHandler redirecting to applications list');

  const commonUsers = await getCommonUserByPersonIds(ctx, [personId]);
  const applicationToken = createJWTToken({
    ...token,
    commonUserId: commonUsers[0].id,
    hasMultipleApplications: true,
  });
  const applicationUrl = `${req.protocol}://${req.hostname}${Routes.applicationList}${applicationToken}`;
  res.redirect(302, applicationUrl);
};

export const propertyLockApplicationHandler = async (req, res, next) => {
  logger.debug({ ctx: req }, 'propertyLockApplicationHandler');
  const token = await getApplicationToken(req, res);
  if (!token || token.isPropertyLockRequest) {
    next();
    return;
  }

  const { tenantId, partyId, personId } = token;
  errorIfHasUndefinedValues({ tenantId, partyId, personId });
  const ctx = req;

  const lockedApplication = await getPartyPropertyLockData(ctx, token);
  if (!lockedApplication) {
    next();
    return;
  }

  const applicationToken = createJWTToken({
    ...omit(token, ['quoteId', 'propertyId', 'iat', 'exp']),
    ...lockedApplication,
    isPropertyLockRequest: true,
  });
  const lockedApplicationUrl = `${req.protocol}://${req.hostname}${Routes.welcome}${applicationToken}`;
  res.redirect(302, lockedApplicationUrl);
};

export const replacePersonIdForMergedPerson = path => async (req, res, next) => {
  logger.debug({ ctx: req }, 'replacePersonIdForMergedPerson');
  const token = await getApplicationToken(req, res);
  if (!token) {
    next && next();
    return;
  }
  req.rentappDecodedToken = token;

  const { tenantId, partyId, personId } = token;
  errorIfHasUndefinedValues({ tenantId, partyId, personId });

  const ctx = req;
  const lastPersonIdMerged = await getLastMergeWithByPersonId(ctx, personId);

  if (!lastPersonIdMerged || (lastPersonIdMerged && lastPersonIdMerged.id === personId)) {
    next();
    return;
  }

  const url = `${req.protocol}://${req.hostname}${path}`;
  const lastPersonMergedApplicationUrl = addTokenToUrls(url, { ...token, personId: lastPersonIdMerged.id });
  res.redirect(301, lastPersonMergedApplicationUrl);
};

export const replacePersonIdForMergedPersonOnAuthUser = async (req, res, next) => {
  if (!req.authUser) {
    next && next();
    return;
  }

  const { tenantId, partyId, personId } = req.authUser;
  const ctx = { ...req, tenantId };
  logger.debug({ ctx }, 'replacePersonIdForMergedPersonOnAuthUser');

  errorIfHasUndefinedValues({ tenantId, partyId, personId });
  const lastPersonIdMerged = await getLastMergeWithByPersonId(ctx, personId);
  const mergedPersonMatch = lastPersonIdMerged && lastPersonIdMerged.id === personId;

  if (mergedPersonMatch) {
    next();
    return;
  }

  req.authUser = { ...req.authUser, personId: lastPersonIdMerged.id };
  next();
  return;
};

export const replacePartyIdForMergedParties = async (req, res, next) => {
  logger.debug({ ctx: req }, 'replacePartyIdForMergedParties');
  const token = await getApplicationToken(req, res);
  if (!token) {
    next();
    return;
  }

  const { tenantId, partyId } = token;
  errorIfHasUndefinedValues({ tenantId, partyId });
  const ctx = req;

  const party = await loadPartyById(ctx, partyId);
  if (!party.mergedWith || party.mergedWith === partyId) {
    next();
    return;
  }
  const applicationToken = createJWTToken({
    ...omit(token, ['quoteId', 'iat', 'exp']),
    partyId: party.mergedWith,
  });
  req.params.rentappToken = applicationToken;
  const applicationUrl = `${req.protocol}://${req.hostname}${Routes.welcome}${applicationToken}`;
  res.redirect(302, applicationUrl);
};

export const replacePartyIdForReaddedPerson = async (req, res, next) => {
  const token = await getApplicationToken(req, res);
  if (!token) {
    next();
    return;
  }

  const { tenantId, partyId, personId } = token;
  errorIfHasUndefinedValues({ tenantId, partyId, personId });
  const ctx = req;

  const partyMembersForPerson = (await getPartyMembersByPersonId(ctx, personId)) || [];
  const isPersonAssociatedToParty = partyMembersForPerson.some(pm => pm.partyId === partyId);
  if (!partyMembersForPerson.length || isPersonAssociatedToParty) {
    next();
    return;
  }

  const partyIds = Array.from(partyMembersForPerson.reduce((acc, pm) => acc.add(pm.partyId), new Set()));
  if (partyIds.length > 1) {
    logger.debug(
      { ctx, personId, oldPartyId: partyId, currentPartyIds: partyIds.join(', ') },
      'replacePartyIdForReaddedPerson: person associated to more than one active party',
    );
    res.redirect(302, `${req.protocol}://${req.hostname}`);
    return;
  }

  logger.debug({ ctx, personId, oldPartyId: partyId, currentPartyId: partyIds[0] }, 'replacePartyIdForReaddedPerson');
  const welcomeUrl = `${req.protocol}://${req.hostname}${Routes.welcome}`;
  const applicationUrl = addTokenToUrls(welcomeUrl, {
    ...omit(token, ['quoteId', 'iat', 'exp']),
    partyId: partyIds[0],
  });
  res.redirect(302, applicationUrl);
};

export const forbiddenOnCorporateParty = async (req, res, next) => {
  const ctx = req;
  logger.debug({ ctx }, 'forbiddenOnCorporateParty');
  try {
    const token = await getApplicationToken(req, res);
    if (!token) {
      next && next();
      return;
    }

    const { partyId } = token;

    const isCorporateParty = await isCorporateLeaseType(ctx, partyId);
    if (isCorporateParty) {
      logger.warn({ ctx }, 'attempt to access application as corporate party');
      next && next({ status: 403, token: 'FORBIDDEN_ON_CORPORATE_PARTY' });
    }
    next && next();
  } catch (err) {
    logger.error({ err, ctx }, 'forbiddenOnCorporateParty caught error');
    next && next(err);
  }
};
