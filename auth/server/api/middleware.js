/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { decodeJWTToken, createJWTToken } from '../../../common/server/jwt-helpers';
import { getCommonUser, getCommonUserByPersonIds } from '../services/common-user';
import { getApplicationUrl } from '../../../rentapp/server/api/helpers/applicant';
import { getApplicationToken } from '../../../rentapp/server/api/middleware';
import { resolveSubdomainURL } from '../../../common/helpers/resolve-url';
import { errorIfHasUndefinedValues } from '../../../common/helpers/validators';
import { getScreeningVersion } from '../../../rentapp/server/helpers/screening-helper';
import { personApplicationProvider } from '../../../rentapp/server/providers/person-application-provider-integration';
import { Routes } from '../../../rentapp/common/enums/rentapp-types';
import loggerModule from '../../../common/helpers/logger';
import { getHostnameFromTenantId } from '../../../server/services/leases/urls';
import { ServiceError } from '../../../server/common/errors';
const logger = loggerModule.child({ subType: 'authMiddleware' });

// Redirects to the login page if the user has finished the registration process.
// The common user is created when you start the application process, but the registration ends
// when the user set a password.
export const redirectIfUserHasPassword = async (req, res, next) => {
  const token = req.query && req.query.token && (await decodeJWTToken(req.query.token));
  if (!token) {
    next();
    return;
  }

  const commonUser = await getCommonUser(req, token.userId);
  if (!(commonUser && commonUser.password)) {
    next();
    return;
  }

  const loginUrl = resolveSubdomainURL(`${req.protocol}://${req.hostname}`, 'application');
  res.redirect(302, loginUrl);
};

export const detectMultipleApplications = async (req, res, next) => {
  logger.debug({ ctx: req }, 'detectMultipleApplications');
  const token = await getApplicationToken(req, res);
  if (!token || token.isNewApplicationRequest || token.impersonatorUserId) {
    next();
    return;
  }

  const { tenantId, partyId, personId, appId } = token;
  errorIfHasUndefinedValues({ tenantId, partyId, personId });
  const ctx = req;

  const screeningVersion = await getScreeningVersion({ tenantId, partyId });

  const commonUsers = await getCommonUserByPersonIds(ctx, [personId]);

  const provider = personApplicationProvider(screeningVersion);

  if (!provider) {
    throw new ServiceError({
      token: 'PROVIDER_NOT_FOUND',
      status: 412,
      message: `Person application provider not found for given screening version ${screeningVersion}`,
    });
  }

  const applicationsByPersonId = await provider.getPersonApplicationsFromCommonUsers(commonUsers);

  const applicationsForPersonAndParty = applicationsByPersonId.filter(app => app.personId === personId && app.partyId === partyId);

  const noApplicationsForPersonAndParty = applicationsForPersonAndParty.length === 0;
  const atMostOneApplicationByGivenPersonId = applicationsByPersonId.length <= 1;

  if (noApplicationsForPersonAndParty || atMostOneApplicationByGivenPersonId) {
    next();
    return;
  }

  const applicationToken = createJWTToken({
    ...token,
    commonUserId: commonUsers[0].id,
    hasMultipleApplications: true,
  });
  const hostname = await getHostnameFromTenantId(ctx, tenantId);
  const applicationUrl = resolveSubdomainURL(`${req.protocol}://${hostname}${Routes.applicationList}${applicationToken}?userId=${commonUsers[0].id}`, appId);
  res.redirect(302, applicationUrl);
};

export const redirectToSourceApp = async (req, res, next) => {
  const token = req.params && req.params.rentappToken && (await decodeJWTToken(req.params.rentappToken));
  if (!token) {
    next();
    return;
  }

  const sourceAppUrl = await getApplicationUrl(req, token);
  if (!sourceAppUrl) {
    next();
    return;
  }

  res.redirect(302, sourceAppUrl);
};
