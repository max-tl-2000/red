/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { notify } from '../../../common/server/notificationClient';
import { ServiceError } from '../../../server/common/errors';
import { getStandardizedAddress, getLocalitiesByZipCode } from '../usps/usps-service';
import { shouldNormalizeAddress } from '../screening/fadv/applicant-data-parser';
import { existsPersonWithEmail } from '../../../server/services/person';
import { DALTypes } from '../../../common/enums/DALTypes';
import { existsEmailPersonApplication } from '../dal/person-application-repo';

const shouldEnhanceApplication = (applicationData, existingPersonApplication) =>
  !applicationData.haveInternationalAddress && shouldNormalizeAddress(applicationData, existingPersonApplication);

// This method make a call to usps provider (Address Standardization and City State Lookup) to enhance the application
// with the standarized address and also with the default locality for the entered zipcode. This action is only performed
// for local addresses and only if the address has changed
export const enhanceApplicationWithStandardizedAddress = async (ctx, rawPersonApplication, existingPersonApplication) => {
  const { applicationData } = rawPersonApplication;
  if (!shouldEnhanceApplication(applicationData, existingPersonApplication)) return null;

  const metadata = {
    personId: rawPersonApplication.personId,
    partyId: rawPersonApplication.partyId,
    ...(existingPersonApplication ? { personApplicationId: existingPersonApplication.id } : {}),
  };

  const standardizedAddress = await getStandardizedAddress(ctx, applicationData, metadata);
  if (standardizedAddress && standardizedAddress.error) {
    return standardizedAddress;
  }

  const locality = standardizedAddress && (await getLocalitiesByZipCode(ctx, standardizedAddress.zip, metadata));

  standardizedAddress && Object.assign(rawPersonApplication.applicationData, { standardizedAddress });
  locality && Object.assign(rawPersonApplication.applicationData, { locality });

  return null;
};

const isUniqueEmail = async (email, validateFn) => {
  if (!email || !(await validateFn(email))) return;
  throw new ServiceError({ token: 'EMAIL_ALREADY_USED', status: 412 });
};

export const validateUniqueEmail = async (ctx, email, personId) => isUniqueEmail(email, emailAddress => existsPersonWithEmail(ctx, emailAddress, personId));

export const validateQuotePromotions = async (ctx, partyId) => {
  // eslint-disable-next-line global-require
  const { loadAllQuotePromotions } = require('../../../server/services/quotePromotions');
  const quotePromotions = await loadAllQuotePromotions(ctx, partyId);
  const approvedQuotePromotions = quotePromotions.some(quote => quote.promotionStatus === DALTypes.PromotionStatus.APPROVED);

  if (!approvedQuotePromotions) return;
  throw new ServiceError({
    token: 'APPLICATION_CANNOT_BE_EDITED',
    status: 500,
  });
};

// TODO: this needs to be added to the applicant data provider for screening V2
export const validateUniqueEmailApplication = async (ctx, email, partyId, personApplicationId) =>
  isUniqueEmail(email, emailAddress => existsEmailPersonApplication(ctx, emailAddress, partyId, personApplicationId));

export const notifyApplicationEvent = (notifyData, application, event) =>
  notify({
    ...notifyData,
    event,
    data: {
      partyId: application.partyId,
      personId: application.personId,
      applicationId: application.id,
    },
  });
