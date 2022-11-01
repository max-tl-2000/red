/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import config from '../../../config';
import { read } from '../../../../common/helpers/xfs';
import logger from '../../../../common/helpers/logger';
import { fillHandlebarsTemplate } from '../../../../common/helpers/handlebars-utils';
import { getFadvCredentials, getFadvProperty, validateFADVRequiredData, parseNoneAsciiCharactersInFADVUserData } from '../../helpers/base-fadv-helper';
import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes';
import { formatSimpleAddress } from '../../../../common/helpers/addressUtils';
import { FADV_RESPONSE_CUSTOM_RECORDS } from '../../screening/fadv/screening-report-parser';
import { isScreeningRequestTypeValid } from '../../helpers/fadv-helper';
import { obscureApplicantProperties, validateRequestType, mapReportNametoFADVCode } from '../../helpers/screening-helper';
import { ApplicationAddress, IFadvApplicantData, IRentData } from '../../helpers/applicant-types';
import { FadvRequestTypes } from '../../../../common/enums/fadvRequestTypes';
import { IDbContext, IDictionaryHash } from '../../../../common/types/base-types';
import * as fadvServiceAdapter from './adapters/fadv-service-adapter';
import * as fakeFadvServiceAdapter from './adapters/fake-fadv-service-adapter';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { SSN_NON_NUMERIC_CHARACTERS } from '../../../../common/regex';
import { getPreviousTenantIdFromLatestNewRequest } from './screening-helper';

export const getScreeningRequestType = (screeningTypeRequested: string, defaultType: string): string =>
  isScreeningRequestTypeValid(screeningTypeRequested) ? screeningTypeRequested : defaultType;

// strip all non-numeric characters from SSN
const formatSSN = (socSecNumber: string): string => socSecNumber.replace(SSN_NON_NUMERIC_CHARACTERS, '');
const formatZipCode = (zipCode: string): string => `${zipCode || ''}`.trim().split('-')[0];

const mapScreeningAddress = (applicant: any): object => {
  const { enteredByUser, normalized, locality }: ApplicationAddress = applicant.address || {};
  if (!normalized) {
    return {
      ...applicant,
      screeningAddress: enteredByUser,
    };
  }

  const addressLine1 = normalized.line1;
  const addressLine2 = normalized.line2;
  const city = locality && locality.city;
  const state = normalized.state;
  const zip = normalized.postalCode;
  const postalCode = normalized.postalCode;

  return {
    ...applicant,
    screeningAddress: {
      ...normalized,
      ...(locality
        ? {
            city: locality.city,
            unparsedAddress: formatSimpleAddress({ addressLine1, addressLine2, city, state, zip, postalCode }),
          }
        : {}),
    },
  };
};

export interface IFadvRawRequest {
  rawRequest: string;
  id: string;
}

export interface IFadvRawRequestOptions {
  version?: string;
  requestType?: string;
  reportId?: string;
  submissionRequestId: string;
  reportName?: string;
}

/**
 * Create a FADV Submision Request
 *
 * @param {string} propertyId - Property name
 * @param {IRentData} rentData - Rent data which will be posted to FADV service
 * @param {number} rentData.monthlyRent - Monthly rent
 * @param {number} rentData.leaseMonths - Lease months
 * @param {IFadvApplicantData} applicantData - Applicants who are posted to FADV service
 * @param {IApplicationData[]} applicantData.applicants - Applicants list to be posted
 * @param {Object} applicantData.applicants[].name - Applicant's full name property
 * @param {string} applicantData.applicants[].name.firstName - Applicant's first name
 * @param {string} applicantData.applicants[].name.lastName - Applicant's last name
 * @param {string} applicantData.partyApplicationId
 * @param {IFadvRawRequestOptions} options - additional options to create the screening
 * @param {string} options.requestType - fadv request type: New, Modify, View
 * @param {number} options.reportId - reportId of previous screening
*  @return {IFadvRawRequest} object with fadv request
*    @param rawRequest {String} raw request
*    @param id {Guid} screening request id

*/
export const createFadvRawRequest = async (
  ctx: IDbContext,
  propertyId: string,
  rentData: IRentData,
  applicantData: IFadvApplicantData,
  options: IFadvRawRequestOptions = {
    version: ScreeningVersion.V1,
    requestType: FadvRequestTypes.NEW,
    reportId: '',
    submissionRequestId: '',
  },
): Promise<IFadvRawRequest> => {
  logger.debug({ ctx, propertyId, rentData, options }, 'createFadvRawRequest create fadv raw request');
  validateRequestType(ctx, options.requestType);

  const credentials = await getFadvCredentials(ctx);
  const fadvProperty = await getFadvProperty(ctx, propertyId);
  const fadvReportName = options.reportName ? mapReportNametoFADVCode[options.reportName.toLowerCase()] : '01';
  const additionalData = {
    requestType: options.requestType,
    reportId: options.reportId,
    propertyId: fadvProperty,
    reportOptions: { reportName: fadvReportName },
  };

  const applicantId = applicantData.applicants[0].applicantId;
  const tenantId =
    (options.requestType !== FadvRequestTypes.NEW && (await getPreviousTenantIdFromLatestNewRequest(ctx, applicantId))) || applicantData.tenantId;

  const applicantDataWihScreeningAddress = {
    ...applicantData,
    tenantId,
    applicants: applicantData.applicants.map(mapScreeningAddress),
  };

  const applicantDataWithCustomRecords = options.submissionRequestId
    ? {
        ...applicantDataWihScreeningAddress,
        customRecords: {
          [FADV_RESPONSE_CUSTOM_RECORDS.SCREENING_REQUEST_ID]: options.submissionRequestId,
          [FADV_RESPONSE_CUSTOM_RECORDS.VERSION]: options.version || ScreeningVersion.V1,
          [FADV_RESPONSE_CUSTOM_RECORDS.TENANT_ID]: ctx.tenantId,
          [FADV_RESPONSE_CUSTOM_RECORDS.ENVIRONMENT]: process.env.CLOUD_ENV,
        },
      }
    : applicantDataWihScreeningAddress;
  const data = {
    additionalData,
    credentials,
    rentData,
    applicantData: applicantDataWithCustomRecords,
  };

  validateFADVRequiredData(data);
  parseNoneAsciiCharactersInFADVUserData(data);

  const fadvRequestXmlTemplate = await read(path.resolve(__dirname, `../../resources/${config.fadv.xmlRequestTemplate}`));
  logger.debug(
    { ctx, additionalData, rentData, ...obscureApplicantProperties({ applicantData: applicantDataWihScreeningAddress }) },
    'populating fadv xml request template',
  );

  return {
    rawRequest: await fillHandlebarsTemplate(fadvRequestXmlTemplate.toString(), data, { formatSSN, formatZipCode }),
    id: options.submissionRequestId,
  };
};

export const getFadvServiceOps = (screeningMode: string): IDictionaryHash<any> =>
  screeningMode === DALTypes.ScreeningProviderMode.FAKE ? { postToFADV: fakeFadvServiceAdapter.postToFADV } : { postToFADV: fadvServiceAdapter.postToFADV };
