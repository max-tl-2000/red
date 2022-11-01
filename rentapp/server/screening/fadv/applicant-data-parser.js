/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import { DATE_US_FORMAT, DATE_ONLY_FORMAT } from '../../../../common/date-constants';
import { formatSimpleAddress } from '../../../../common/helpers/addressUtils';
import { isSSNValid, isItin } from '../../../../common/helpers/validations';
import { formatPhoneNumberForDb } from '../../../../server/helpers/phoneUtils';
import { getGrossIncomeMonthly } from '../../../common/helpers/applicant-helpers';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { hasCorrectFormat } from '../../../../common/helpers/date-utils';
import nullish from '../../../../common/helpers/nullish';

const parseLocalAddress = (applicationData = {}) => {
  const unparsedAddress = formatSimpleAddress(applicationData);
  const address = applicationData.addressLine2 ? `${applicationData.addressLine1} ${applicationData.addressLine2}` : applicationData.addressLine1;
  return {
    line1: applicationData.addressLine1,
    line2: applicationData.addressLine2,
    city: applicationData.city,
    state: applicationData.state,
    postalCode: applicationData.zip,
    unparsedAddress,
    address,
  };
};

const getExistingUserAddress = ({ applicationData = {} } = {}) => (applicationData.address || {}).enteredByUser;

export const shouldNormalizeAddress = (applicationData, existingPersonApplication) => {
  const userAddress = parseLocalAddress(applicationData);
  if (!userAddress.unparsedAddress) return false;
  const existingUserAddress = getExistingUserAddress(existingPersonApplication);
  return existingUserAddress ? !isEqual(userAddress, existingUserAddress) : true;
};

export const getScreeningAddress = (applicationData, existingPersonApplication) => {
  if (applicationData.haveInternationalAddress) {
    return {
      enteredByUser: {
        unparsedAddress: applicationData.addressLine,
      },
    };
  }

  const userAddress = parseLocalAddress(applicationData);
  if (!shouldNormalizeAddress(applicationData, existingPersonApplication)) {
    if (existingPersonApplication && userAddress.unparsedAddress) return existingPersonApplication.applicationData.address;
  }

  return {
    enteredByUser: userAddress,
    ...((applicationData.standardizedAddress && { normalized: parseLocalAddress(applicationData.standardizedAddress) }) || {}),
    ...((applicationData.locality && { locality: applicationData.locality }) || {}),
  };
};

const newAddressValuesReceived = (applicationData = {}) => {
  const { addressLine1, city, state, zip, postalCode } = applicationData;
  return !nullish(addressLine1) || !nullish(city) || !nullish(state) || !nullish(zip) || !nullish(postalCode);
};

export const mapScreeningApplicantData = (rawPersonApplication, existingPersonApplication) => {
  const { applicationData } = rawPersonApplication;
  const applicant = omit(applicationData, ['addressLine1', 'addressLine2', 'city', 'state', 'zip', 'socSecNumber', 'standardizedAddress', 'locality']);
  applicant.address = newAddressValuesReceived(applicationData)
    ? getScreeningAddress(applicationData, existingPersonApplication)
    : applicationData.address || { enteredByUser: {} };
  applicant.dateOfBirth = hasCorrectFormat(applicant.dateOfBirth, DATE_ONLY_FORMAT)
    ? applicant.dateOfBirth
    : toMoment(applicant.dateOfBirth, { parseFormat: DATE_US_FORMAT }).format(DATE_ONLY_FORMAT);

  applicant.grossIncomeMonthly = getGrossIncomeMonthly(applicationData);

  if (applicant.phone) applicant.phone = formatPhoneNumberForDb(applicant.phone);

  const isSocSecNumberValid = isSSNValid(applicationData.socSecNumber);

  if (!isSocSecNumberValid) return applicant;

  const isMaskedSocSecNumber = !isSSNValid(applicationData.socSecNumber, true);

  if (existingPersonApplication && isMaskedSocSecNumber) {
    const { applicationData: applicantFromDB } = existingPersonApplication;
    applicant.ssn = applicantFromDB.ssn;
    applicant.itin = applicantFromDB.itin;
    return applicant;
  }

  if (isItin(applicationData.socSecNumber)) {
    applicant.itin = applicationData.socSecNumber;
    applicant.ssn = null;
  } else {
    applicant.ssn = applicationData.socSecNumber;
    applicant.itin = null;
  }

  return applicant;
};
