/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import { ServiceError } from '../../../../server/common/errors';
import { isUuid as utilsIsUuid } from '../../../../server/common/utils';
import { getPersonsByIds } from '../../../../server/services/person';
import { getAllScreeningRequestsForParty } from '../../dal/fadv-submission-repo';
import { getPartyMembersByPartyIds } from '../../../../server/dal/partyRepo';
import { getPartyApplicationByPartyId } from '../../services/party-application';
import { getPersonApplication } from '../../services/person-application';
import loggerModule from '../../../../common/helpers/logger';

import { isPOBoxAddress } from '../../helpers/address';
import { getCommonUserByPersonId } from '../../../../auth/server/services/common-user';
import { APPLICANT_SUFFIX_MAX_CHARACTERS } from '../../../common/application-constants';

const logger = loggerModule.child({ subType: 'rentappValidators' });

const throwIfNotUUID = validator => (...args) => {
  const errorToken = args.pop();
  if (!validator(...args)) {
    throw new ServiceError({ token: errorToken, status: 400 });
  }
};

export const isUuid = id => utilsIsUuid(id);

export const uuid = throwIfNotUUID(isUuid);

const getPersonDefaultEmailAddress = person => {
  const emails = get(person, 'contactInfo.emails', []);
  return emails.find(email => email.id === person.contactInfo.defaultEmailId) || undefined;
};

const shouldUpdateEmail = (defaultEmailAddress, emailFromApplicationData, commonUser) =>
  !defaultEmailAddress ||
  defaultEmailAddress.value === emailFromApplicationData ||
  defaultEmailAddress.isAnonymous ||
  (commonUser && commonUser.email === emailFromApplicationData);

export const canUpdateEmail = async (ctx, { personId, partyId, applicationData: { email } }) => {
  uuid(personId, 'INCORRECT_PERSON_ID');
  uuid(partyId, 'INCORRECT_PARTY_ID');

  const [personInfo] = await getPersonsByIds(ctx, [personId]);
  const commonUser = await getCommonUserByPersonId(ctx, personId);
  const emailAddress = getPersonDefaultEmailAddress(personInfo);

  if (shouldUpdateEmail(emailAddress, email, commonUser)) return null;

  logger.warn({ ctx, personId, partyId, emailAddress: emailAddress?.value, email }, 'Attempted to update email from default');
  return {
    error: {
      token: 'CANT_UPDATE_EMAIL',
    },
  };
};

const allApplicantsHaveScreening = (screenings, personIds) => {
  const applicantsPersonIds = screenings.reduce((acc, screening) => {
    acc.push(...screening.applicantData.applicants.map(applicant => applicant.personId));
    return acc;
  }, []);

  return personIds.every(personId => applicantsPersonIds.includes(personId));
};

// When there is a valid (? and unexpired ?) screening request for the party, holds are not permitted
export const assertNoScreeningRequests = async (ctx, partyId) => {
  const partyMembers = await getPartyMembersByPartyIds(ctx, [partyId]);
  const personIds = partyMembers.map(partyMember => partyMember.personId);
  const partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  const screeningRequests = await getAllScreeningRequestsForParty(ctx, partyId);

  const cancelHoldAction = screeningRequests && screeningRequests.length && allApplicantsHaveScreening(screeningRequests, personIds);
  const applicationIsHeld = cancelHoldAction && personIds.length === 1 && partyApplication && partyApplication.isHeld;

  if (applicationIsHeld) return;

  if (cancelHoldAction) {
    throw new ServiceError({ token: 'HOLD_ACTION_CANCELED', status: 412 });
  }
};

export const validateWaivedFeeStatus = async (ctx, personApplicationId) => {
  const { isFeeWaived } = ctx.body;
  const application = await getPersonApplication(ctx, personApplicationId);
  const { isFeeWaived: isFeeWaivedFromDB } = application;
  if (isFeeWaived === isFeeWaivedFromDB) {
    throw new ServiceError({ token: 'UPDATED_WAIVED_FEE_STATUS_CANCELED', status: 412 });
  }
};

export const validateApplicationAddress = (ctx, { applicationData: { addressLine, addressLine1 } }) => {
  const addressToValidate = addressLine || addressLine1;
  if (!isPOBoxAddress(addressToValidate)) return null;

  logger.warn({ ctx, addressLine, addressLine1 }, `${addressToValidate} is a PO Box address`);
  return {
    error: {
      token: 'PO_BOX_ADDRESS',
    },
  };
};

export const validateApplicantSuffix = (ctx, { applicationData: { suffix } }) =>
  suffix?.length > APPLICANT_SUFFIX_MAX_CHARACTERS ? { error: { token: 'SUFFIX_TOO_LONG' } } : null;
