/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { getPartyApplicationByPartyId } from '../../services/party-application';
import { getCommonUserByPersonId } from '../../../../auth/server/services/common-user';
import { assert } from '../../../../common/assert';
import { personApplicationProvider } from '../../providers/person-application-provider-integration';

const hasPaidApplication = async (ctx, personApplicationId) => {
  const app = (await personApplicationProvider(ctx.screeningVersion).getPersonApplicationById(ctx, personApplicationId)) || {};
  return app.paymentCompleted;
};

// TODO: CPM-7383 - we need to get the applicant information in the cases we only have the personApplicationId, after reset password you are redirected to the page 2
export const handleApplicationAdditionalInfo = async (req, res, next) => {
  const {
    quoteId,
    tenantId,
    personId,
    partyId,
    personName,
    tenantDomain,
    propertyId,
    commonUserId,
    personApplicationId,
    hasMultipleApplications,
    screeningVersion,
  } = req.rentappDecodedToken;
  assert(tenantId, 'handleApplicationAdditionalInfo: tenantId not found');
  assert(personId, 'handleApplicationAdditionalInfo: personId not found');
  assert(partyId, 'handleApplicationAdditionalInfo: partyId not found');

  const ctx = { ...req, tenantId };

  if (commonUserId && personApplicationId && (await hasPaidApplication({ ...ctx, screeningVersion }, personApplicationId))) {
    next();
    return;
  }

  const partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  assert(partyApplication, 'handleApplicationAdditionalInfo: partyApplication not found');

  const personApplication = await personApplicationProvider(screeningVersion).getPersonApplication(ctx, personId, partyApplication.id, {
    includeApplicationsWherePartyMemberIsInactive: true,
  });

  assert(personApplication, 'handleApplicationAdditionalInfo: personApplication not found');

  const commonUser = await getCommonUserByPersonId(ctx, personId);
  assert(commonUser, 'handleApplicationAdditionalInfo: commonUser not found');

  const newToken = createJWTToken({
    tenantId,
    commonUserId: commonUser.userId,
    personApplicationId: personApplication.id,
    personId,
    personName,
    partyApplicationId: partyApplication.id,
    quoteId,
    partyId,
    tenantDomain,
    propertyId,
    hasMultipleApplications,
    screeningVersion,
  });
  const origin = req.query.origin ? `?origin=${req.query.origin}` : '';
  res.redirect(301, `/applicationAdditionalInfo/${newToken}${origin}`);
};
