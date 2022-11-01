/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js-es6-promise';
import { readFileAsString } from '../../../../../common/helpers/file';
import { readJSON } from '../../../../../common/helpers/xfs';
import { fillHandlebarsTemplate } from '../../../../../common/helpers/handlebars-utils';
import logger from '../../../../../common/helpers/logger';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import { FADV_SERVICE_STATUS } from '../../../../common/enums/fadv-service-status';
import timedOut from '../../../../../common/helpers/sleep';
import config from '../../config';
import { FADV_RESPONSE_STATUS } from '../../../../common/screening-constants';
import { SCREENING_MESSAGE_TYPE } from '../../../../../server/helpers/message-constants';
import {
  getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm,
  getSubmissionResponseBySubmissionRequestId,
  getSubmissionRequest,
} from '../../../dal/fadv-submission-repo';

const BASE_PATH = 'rentapp/server/screening/fadv/__integration__/fixtures/';
const DUMMY_INVALID_SSN = '555-55-5555';
const DUMMY_BAD_NAME_SSN = 'BADSSN';
const CRITERIA_PASS = 'P';
const CRITERIA_FAIL = 'F';

const areApplicantsNamesEqual = (sourceEntry, matchEntry) =>
  sourceEntry.name.firstName === matchEntry.firstName && sourceEntry.name.lastName === matchEntry.lastName;

const areApplicantsConditionsEqual = (applicantsSource, applicantsMatch) =>
  applicantsMatch.applicants.length === applicantsSource.applicants.length &&
  applicantsMatch.applicants.every(matchEntry => applicantsSource.applicants.some(sourceEntry => areApplicantsNamesEqual(sourceEntry, matchEntry)));

const isMonthlyRentEqual = ({ leaseTerms }, { rent }) => parseFloat(leaseTerms.monthlyRent) === parseFloat(rent);
const isLeaseTermEqual = ({ leaseTerms }, { leaseTermMonths }) => leaseTerms.leaseMonths === leaseTermMonths;

const areLeaseTermsDataEqual = (applicantsSource, rentData) =>
  applicantsSource.leaseTerms ? isMonthlyRentEqual(applicantsSource, rentData) && isLeaseTermEqual(applicantsSource, rentData) : true;

const areApplicantsEqual = (applicantsSource, applicantsMatch, rentData) =>
  areApplicantsConditionsEqual(applicantsSource, applicantsMatch) && areLeaseTermsDataEqual(applicantsSource, rentData);

const getMockRepository = async () => {
  const filePath = 'rentapp/server/workers/screening/__tests__/mock-test-scenarios.json';
  return readJSON(filePath);
};

const findMatchingScenario = (mockedApplicantScenarios, rentData, applicantData) =>
  mockedApplicantScenarios.find(mockedApplicantScenario => areApplicantsEqual(mockedApplicantScenario, applicantData, rentData)) || {};

const overrideSections = {
  additionalDeposit: {
    OverrideID: 505,
    OverrideText: 'An additional deposit is required',
  },
  ssn: {
    OverrideID: 1550,
    OverrideText: 'Applicant must provide official documentation to verify name and social security number',
  },
  addAGuarantor: {
    OverrideID: 800,
    OverrideText: 'An approved guarantor is required',
  },
  increaseDeposit2X: {
    OverrideID: 500,
    OverrideText: 'Increase deposit by 2x',
  },
};

const checkForInvalidSSN = applicantData =>
  applicantData.applicants.find(applicant => applicant.socSecNumber === DUMMY_INVALID_SSN || applicant.firstName === DUMMY_BAD_NAME_SSN);

// mutates the payload with a fake application decision that is tied to the rent requested and whether or not they
// have a guarantor
const populatePayloadWithFakeDecisions = payload => {
  logger.debug('populatePayloadWithFakeDecisions');

  const { rentData, applicantData } = payload;
  const recommendations = [];
  const { applicants } = applicantData;
  const { rent } = rentData;
  let applicationDecision;
  let criteriaResult;

  if (rent >= 6500) {
    applicationDecision = ScreeningDecision.DECLINED;
    criteriaResult = CRITERIA_FAIL;
  } else if (rent >= 5500) {
    // only accept if they have a guarantor
    const hasGuarantor = applicants.some(applicant => applicant.guarantorFor);
    applicationDecision = hasGuarantor ? ScreeningDecision.APPROVED : ScreeningDecision.GUARANTOR_REQUIRED;
    criteriaResult = hasGuarantor ? CRITERIA_PASS : CRITERIA_FAIL;
    !hasGuarantor && recommendations.push(overrideSections.addAGuarantor);
    // !hasGuarantor && recommendations.push(overrideSections.increaseDeposit2X);
  } else if (rent >= 4000) {
    applicationDecision = ScreeningDecision.APPROVED_WITH_COND;
    recommendations.push(overrideSections.additionalDeposit);
    criteriaResult = CRITERIA_FAIL;
  } else {
    applicationDecision = ScreeningDecision.APPROVED;
    criteriaResult = CRITERIA_PASS;
  }

  if (checkForInvalidSSN(applicantData)) {
    applicationDecision = ScreeningDecision.APPROVED_WITH_COND;
    recommendations.push(overrideSections.ssn);
  }

  applicationDecision = applicationDecision.toUpperCase();

  payload.applicationDecision = applicationDecision;
  payload.recommendations = recommendations;

  // in real life, each applicant can have a separate decision.  But this is not real life.
  applicants.forEach(applicant => {
    applicant.decision = applicationDecision;
    applicant.criteriaResult = criteriaResult;
  });
};

const validateGuarantorsMatchApplicants = (tenantId, applicants) => {
  const guarantorsFor = applicants.filter(applicant => applicant.guarantorFor).reduce((acc, applicant) => [...acc, ...applicant.guarantorFor.split('^')], []);
  const applicantIds = applicants.map(applicant => `${tenantId}:${applicant.applicantId}`);
  const doGuarantorsMatchApplicants = guarantorsFor.every(guarantorFor => applicantIds.includes(guarantorFor));
  if (!doGuarantorsMatchApplicants) {
    const badGuarantorsFor = guarantorsFor.filter(guarantorFor => !applicantIds.includes(guarantorFor));
    logger.error({ badGuarantorsFor, applicantIds }, 'Guarantors do not match applicants');
    throw new Error(`GuarantorFor fields ${badGuarantorsFor} do not match applicants`);
  }
};

const getResponseStatus = async (ctx, { applicantData, quoteId, rentData }, includeServiceStatusOnFirstNew) => {
  if (!includeServiceStatusOnFirstNew) return FADV_RESPONSE_STATUS.COMPLETE;

  const { partyApplicationId, customRecords = {} } = applicantData;

  const { origin } = await getSubmissionRequest(ctx, customRecords.screeningRequestId);

  const prevSubmissionRequest = await getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm(ctx, partyApplicationId, quoteId, rentData.leaseTermMonths);

  const prevSubmissionResponse = prevSubmissionRequest && (await getSubmissionResponseBySubmissionRequestId(ctx, prevSubmissionRequest.id, false));
  return ((!prevSubmissionResponse || origin === SCREENING_MESSAGE_TYPE.SEND_SSN_CHANGED) && FADV_RESPONSE_STATUS.INCOMPLETE) || FADV_RESPONSE_STATUS.COMPLETE;
};

const getResponseServiceStatus = (defaultServiceStatus, areServicesComplete, isCreditServiceFrozen) => {
  if (isCreditServiceFrozen) return FADV_SERVICE_STATUS.BLOCKED;
  if (areServicesComplete) return FADV_SERVICE_STATUS.COMPLETED;
  return defaultServiceStatus;
};

const getMockServiceStatus = (includeServiceStatusOnFirstNew, areServicesComplete, isCreditServiceFrozen, applicants = []) => {
  if (!includeServiceStatusOnFirstNew) {
    return [];
  }

  return applicants.map(applicant => {
    const { firstName, lastName } = applicant;
    return {
      applicantName: [firstName, lastName].join(' '),
      services: [
        { serviceName: 'Criminal', serviceStatus: getResponseServiceStatus(FADV_SERVICE_STATUS.IN_PROCESS, areServicesComplete) },
        { serviceName: 'Criminal', serviceStatus: getResponseServiceStatus(FADV_SERVICE_STATUS.INCOMPLETE, areServicesComplete) },
        { serviceName: 'Credit', serviceStatus: getResponseServiceStatus(FADV_SERVICE_STATUS.IN_PROCESS, areServicesComplete, isCreditServiceFrozen) },
        { serviceName: 'Credit', serviceStatus: getResponseServiceStatus(FADV_SERVICE_STATUS.INCOMPLETE, areServicesComplete, isCreditServiceFrozen) },
      ],
    };
  });
};

const getApplicationDecision = ({ applicationDecision }, responseStatus, includeServiceStatusOnFirstNew, scenarioFile) => {
  const isApplicationDecisionEmptyAndResponseStatusComplete = !applicationDecision && responseStatus === FADV_RESPONSE_STATUS.COMPLETE;
  if (!scenarioFile && isApplicationDecisionEmptyAndResponseStatusComplete && !includeServiceStatusOnFirstNew) {
    throw new Error('The status of screening response can not be COMPLETE if the application decision is empty');
  } else if (scenarioFile && isApplicationDecisionEmptyAndResponseStatusComplete && includeServiceStatusOnFirstNew) {
    applicationDecision = ScreeningDecision.APPROVED.toUpperCase();
  }
  return applicationDecision;
};

/*
 * getFADVFakeScenarioAndPostResponse
 * @param {Object} payload - object containing the required properties for fake getPostToFADV
 * @param {string} payload.propertyId - Property name
 * @param {Object} payload.rentData - Rent data which will be posted to FADV service
 * @param {Object} payload.rentData.leaseTerms - Lease terms of the applicants
 * @param {number} payload.rentData.leaseTerms.monthlyRent - Monthly rent
 * @param {number} payload.rentData.leaseTerms.leaseMonths - Lease months
 * @param {Object} payload.applicantData - Applicants who are posted to FADV service
 * @param {Object[]} payload.applicantData.applicants - Applicants list to be posted
 * @param {Object} payload.applicantData.applicants[].name - Applicant's full name property
 * @param {string} payload.applicantData.applicants[].name.firstName - Applicant's first name
 * @param {string} payload.applicantData.applicants[].name.lastName - Applicant's last name
 * @return {string} Output is a XML file name
 */
const getFADVFakeScenarioAndPostResponse = async (ctx, payload) => {
  if (!payload || !payload.applicantData || !payload.rentData) {
    throw new Error('No payload found!');
  }
  logger.trace('getFADVFakeScenarioAndPostResponse');

  const GENERIC_TEMPLATE_FILE = 'generic-response-template.xml';

  const repository = await getMockRepository();
  const { post: scenarioXMLFile, includeServiceStatusOnFirstNew, areServicesComplete, isCreditServiceFrozen } = findMatchingScenario(
    repository.data,
    payload.rentData,
    payload.applicantData,
  );
  const {
    applicants,
    customRecords: { screeningRequestId, version },
  } = payload.applicantData;
  const { tenantId } = ctx;
  logger.trace({ ctx, screeningRequestId }, 'getFADVFakeScenarioAndPostResponse extracted data');

  const scenarioFile = applicants.some(applicant => applicant.haveInternationalAddress) ? 'sceneario-unable-to-parse-address-error.xml' : scenarioXMLFile;

  validateGuarantorsMatchApplicants(tenantId, applicants);

  if (!scenarioFile) {
    populatePayloadWithFakeDecisions(payload);
  }

  const templateFile = scenarioFile || GENERIC_TEMPLATE_FILE;
  let filledResponseTemplate;
  try {
    const responseXmlFromScenario = await readFileAsString(templateFile, BASE_PATH);
    // These represent the fadv-generated identifers for each applicant
    const responseStatus = await getResponseStatus(ctx, payload, includeServiceStatusOnFirstNew);
    const applicationDecision = getApplicationDecision(payload, responseStatus, includeServiceStatusOnFirstNew, scenarioFile);
    const applicantsWithIds = applicants.map((applicant, idx) => ({ ...applicant, decision: applicationDecision, fadvApplicantId: `123456${idx}` }));
    filledResponseTemplate = await fillHandlebarsTemplate(responseXmlFromScenario, {
      tenantId,
      screeningRequestId,
      applicants: applicantsWithIds,
      applicationDecision,
      recommendations: payload.recommendations,
      responseStatus,
      serviceStatus: getMockServiceStatus(includeServiceStatusOnFirstNew, areServicesComplete, isCreditServiceFrozen, applicants),
      version,
    });
  } catch (error) {
    logger.error({ error }, 'Error while reading xml scenario');
    throw error;
  }

  return xml2js(filledResponseTemplate);
};

/*
 * Post XML To FADV
 * @return {string} Output is a XML file name and this is temporary. When this feature is released
                    (we have real connection to fadv). The output will be a promise resolving to JS and
                    the resolved JS will represent the XML structure of the response
*/
export const postToFADV = async (ctx, payload, { screeningMode } = {}) => {
  logger.trace({ ctx }, screeningMode, 'postToFADV');
  const response = await getFADVFakeScenarioAndPostResponse(ctx, payload);

  const isCucumberJob = (process.env.CLOUD_ENV || '').startsWith('cucumber');
  const timeout = isCucumberJob || !config.isProduction ? 200 : 10000;
  logger.trace({ isCucumberJob, timeout }, 'postToFADV');
  await timedOut(timeout);

  return response;
};
