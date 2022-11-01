/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import _ from 'lodash'; // eslint-disable-line red/no-lodash
import { getPropertyById } from '../../../server/services/properties';
import { ServiceError } from '../../../server/common/errors';
import config from '../../../server/config';
import logger from '../../../common/helpers/logger';
import Diacritics from '../../../common/helpers/diacritics';
import { getTenantScreeningSettings } from '../../../server/dal/tenantsRepo';

export const APPLICANT_TYPE_APPLICANT = 'Applicant';
export const APPLICANT_TYPE_OCCUPANT = 'Occupant';
export const APPLICANT_TYPE_GUARANTOR = 'Guarantor';

export const getFadvCredentials = async ctx => {
  logger.trace({ ctx }, 'getting fadv credentials');
  const tenantContext = {
    ...ctx,
    tenantId: config.auth.commonSchema,
  };
  const settings = await getTenantScreeningSettings(tenantContext, ctx.tenantId);
  if (!settings) {
    throw new Error(`No settings found for tenant ${ctx.tenantId}`);
  }
  return {
    originatorId: settings.screening.originatorId,
    userName: settings.screening.username,
    // Leaving this field blank as it is only used for tracking purposes not
    // relevant to the demo.
    marketingSource: '',
    password: settings.screening.password,
  };
};

export const getFadvProperty = async (ctx, propertyId) => {
  const property = await getPropertyById(ctx, propertyId);

  const propertyName = _.get(property, 'settings.screening.propertyName', '');
  if (!propertyName) {
    logger.error({ ctx, propertyId }, 'Unable to find FADV propertyId!');
    throw new ServiceError('ID_VALUE_FOR_PROPERTY_NOT_PRESENT');
  }

  return {
    identification: { propertyName },
    marketingName: property.name,
  };
};

const credentialProperties = ['originatorId', 'marketingSource', 'userName', 'password'];
const applicantDataProperties = ['personId', 'type', 'email', 'firstName', 'lastName', 'dateOfBirth', 'address'];
const rentDataProperties = ['rent', 'deposit', 'leaseTermMonths'];
const additionalDataProperties = ['propertyId', 'requestType', 'reportOptions'];
const requestDataProperties = ['additionalData', 'credentials', 'rentData', 'applicantData'];

const isValid = (obj, property) => _.has(obj, property) || !_.isEmpty(obj[property]);

const validateCredentials = credentialData => credentialProperties.every(property => _.has(credentialData, property));
/**
 * validate the Applicant data
 * @param {Object} applicantData - Applicant data
 * @return {boolean} true or false
 */
const validateApplicantData = applicantData =>
  applicantData.applicants.every(applicant => applicantDataProperties.every(applicantProperty => isValid(applicant, applicantProperty)));
/**
 * validate the Rent data
 * @param {Object} rentData - Rent data
 * @return {boolean} true or false
 */
const validateRentData = rentData => rentDataProperties.every(property => _.has(rentData, property));

/**
 * validate the Additional data
 * @param {Object} rentData - Additional data
 * @return {boolean} true or false
 */
const validateAdditionalData = additionalData =>
  isValid(additionalData.propertyId.identification, 'propertyName') && additionalDataProperties.every(property => _.has(additionalData, property));

/**
 * validate the Applicant identifier
 * @param {Object} applicantData - Applicant data
 * @return {boolean} true or false
 */
const validateApplicantIdentifier = applicantData => applicantData.applicants.every(applicant => isValid(applicant, 'applicantId'));

/**
 * validate the Request data properties to be posted as payload.
 * @param {Object} data - Request data
 * @return {boolean} true or false
 */
const validateRequestDataProperties = data => requestDataProperties.every(requestProperty => _.has(data, requestProperty));

const throwIfNotValid = (valid, property) => {
  if (!valid) {
    throw new Error(`Cannot createFADVRequest due to missing ${property}.`);
  }
};

export const validateFADVRequiredData = data => {
  throwIfNotValid(validateRequestDataProperties(data), 'properties');
  throwIfNotValid(validateCredentials(data.credentials), 'credentials');
  throwIfNotValid(validateAdditionalData(data.additionalData), 'additional data');
  throwIfNotValid(validateRentData(data.rentData), 'rent data');
  throwIfNotValid(validateApplicantIdentifier(data.applicantData), 'applicant identifier');
  throwIfNotValid(validateApplicantData(data.applicantData), 'applicant data');
};

export const parseNoneAsciiCharactersInFADVUserData = fADVData => {
  fADVData.additionalData = Diacritics.replaceDiacriticsInObjectOrArray(fADVData.additionalData);
  fADVData.rentData = Diacritics.replaceDiacriticsInObjectOrArray(fADVData.rentData);
  fADVData.applicantData = Diacritics.replaceDiacriticsInObjectOrArray(fADVData.applicantData);
};

export const mapApplicantIdToPersonId = personApplications => _.chain(personApplications).keyBy('applicantId').mapValues('personId').value();
