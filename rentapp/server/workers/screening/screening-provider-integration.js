/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import omit from 'lodash/omit';
import logger from '../../../../common/helpers/logger';
import { createAndStoreFadvRequest } from '../../helpers/fadv-helper';
import { createFadvRawRequest, getFadvServiceOps } from './screening-handler-request.ts';
import { getTenantData } from '../../../../server/dal/tenantsRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { obscureApplicantProperties, obscureFadvRawRequestData } from '../../helpers/screening-helper';

const { ScreeningProviderMode } = DALTypes;

/*
 * Post XML To FADV
 * @param {string} propertyId - Property name
 * @param {Object} rentData - Rent data which will be posted to FADV service
 *  @param {Object} rentData.rent - Dollar amount of the monthly lease for the unit to be leased.
 *  @param {number} rentData.leaseTermMonths - The number of months the lease is in effect.
 *  @param {number} rentData.deposit - Dollar amount of the security deposit required for this lease.
 * @param {Object} applicantData - Applicants who are posted to FADV service
 *  @param {Object[]} applicantData.applicants - Applicants list to be posted
 *    @param {Object} applicantData.applicants[].personId - Identifies the applicant.
 *    @param {string} applicantData.applicants[].type - Applicant type associated with this applicant
                                                        identifier. Supported values include Applicant,
                                                        Co-Applicant, Spouse, Partner, Guarantor and Occupant.
 *    @param {string} applicantData.applicants[].lastName - Applicant’s Last Name
 *    @param {string} applicantData.applicants[].middleName - Applicant's Middle name
 *    @param {string} applicantData.applicants[].firstName - Applicant's First name
 *    @param {string} applicantData.applicants[].dateOfBirth - Applicant’s birth date
 *    @param {string} applicantData.applicants[].email - Applicant's email address
 *    @param {string} applicantData.applicants[].socSecNumber - Applicant’s social security number
 *    @param {string} applicantData.applicants[].grossIncomeMonthly - Dollar amount of applicant's Monthly gross income from employment
 *    @param {Object[]} applicantData.applicants[].address - Applicant's address data
 *      @param {string} applicantData.applicants[].address.normalized.line1 - Address line 1
 *      @param {string} applicantData.applicants[].address.normalized.line2 - Address line 2
 *      @param {string} applicantData.applicants[].address.normalized.city - Address city
 *      @param {string} applicantData.applicants[].address.normalized.state - Address state
 *      @param {string} applicantData.applicants[].address.normalized.postalCode - Address postal code
 * @return {string} Output is a XML file name and this is temporary. When this feature is released
                    (we have real connection to fadv). The output will be a promise resolving to JS and
                    the resolved JS will represent the XML structure of the response
*/

export const postToScreeningProvider = async (ctx, propertyId, rentData, applicantData, options = { storeRequest: true }) => {
  logger.info(
    { ctx, propertyId, rentData, postToScreeningProviderOptions: options, ...obscureApplicantProperties(applicantData) },
    'call postToScreeningProvider',
  );
  const tenant = await getTenantData(ctx);
  const screeningMode = get(tenant.metadata, 'screeningProviderMode', ScreeningProviderMode.FAKE);
  const { quoteId } = rentData;
  const rentDataWithoutQuoteId = omit(rentData, ['quoteId']);
  const { rawRequest, id: screeningRequestId } = await (options.storeRequest
    ? createAndStoreFadvRequest(ctx, propertyId, rentDataWithoutQuoteId, applicantData, quoteId, options.eventType, options)
    : createFadvRawRequest(ctx, propertyId, rentDataWithoutQuoteId, applicantData, options));

  const isFakeScenario = screeningMode === ScreeningProviderMode.FAKE;
  const payload = isFakeScenario
    ? {
        ctx,
        propertyId,
        rentData: rentDataWithoutQuoteId,
        applicantData: {
          ...applicantData,
          customRecords: { screeningRequestId },
        },
        quoteId,
      }
    : rawRequest;

  logger.info(
    {
      ctx,
      screeningMode,
      screeningRequestId,
      // TODO: we are logging full payload here - should not be!
      ...(isFakeScenario ? obscureApplicantProperties({ fadvRequest: payload }) : { fadvRequestPayload: obscureFadvRawRequestData(payload) }),
    },
    'using postToFADV',
  );
  try {
    const postToFADV = getFadvServiceOps(screeningMode).postToFADV;
    const response = await postToFADV(ctx, payload, { screeningMode });
    return { response, screeningRequestId, screeningMode };
  } catch (err) {
    err.screeningRequestId = screeningRequestId;
    throw err;
  }
};

export const postRawRequestToScreeningProvider = async (ctx, { screeningRequestId, payload }) => {
  logger.trace({ ctx, screeningRequestId }, 'postRawRequestToScreeningProvider');
  const tenant = await getTenantData(ctx);
  const screeningMode = get(tenant.metadata, 'screeningProviderMode', ScreeningProviderMode.FAKE);

  logger.info({ ctx, screeningMode, screeningRequestId, fadvRequestPayload: obscureFadvRawRequestData(payload) }, 'using postToFADV');
  try {
    const postToFADV = getFadvServiceOps(screeningMode).postToFADV;
    const response = await postToFADV(ctx, payload, { screeningMode });
    return { response, screeningRequestId };
  } catch (err) {
    err.screeningRequestId = screeningRequestId;
    throw err;
  }
};
