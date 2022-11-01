/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import newId from 'uuid/v4';
import maxBy from 'lodash/maxBy';
import omit from 'lodash/omit';
import get from 'lodash/get';
import uniqBy from 'lodash/uniqBy';
import uniq from 'lodash/uniq';
import filter from 'lodash/filter';
import { getAdditionalInfoByPartyAndType, loadPartyMembers, getPublishedLeaseTermsByPartyIdAndQuoteId, loadPartyById } from '../../../server/services/party';
import { getNonCanceledQuotePromotionByPartyId } from '../../../server/services/quotePromotions';
import {
  getPersonApplicationForScreening,
  getDocumentsForPersonApplication,
  getPersonApplicationsByFilter,
  getPersonApplicationDocumentsByPartyId,
} from '../services/person-application';
import { isUuid } from '../api/helpers/validators';
import { getDocumentsByPartyApplicationId as getDocumentsByPartyApplicationIdService } from '../services/party-application';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import logger from '../../../common/helpers/logger';
import { getSensitiveObject, obscureObject, OBSCURE_VALUE } from '../../../common/helpers/logger-utils';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import { FADV_RESPONSE_STATUS, APPLICATION_EXPIRATION_DAYS } from '../../common/screening-constants';
import { removeEmptySpacesAndNonAlphanumeric, maskSSNWithX } from '../../../common/helpers/utils';
import { assert } from '../../../common/assert';
import { getLeaseTermById } from '../../../server/services/leaseTerms';
import { getInventoryHolds, getInventoryForQuote } from '../../../server/services/inventories';
import { loadUserById } from '../../../server/services/users';
import { SummaryWarningTypes } from '../../common/enums/warning-types';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { getSensitiveXmlDataMatchers } from '../../../common/regex';
import { isScreeningRequestTypeValid } from './fadv-helper';
import { ServiceError } from '../../../server/common/errors';
import { ApplicantReportNames } from '../../../common/enums/screeningReportTypes';
import { getTenantScreeningVersion } from '../../../server/services/tenantService';
import { getPartyUrl } from '../../../server/helpers/party';
import { getFullName } from '../../../common/helpers/personUtils';

const FAIL_CRITERIA = 'F';

export const validateRequestType = (ctx, requestType) => {
  if (!isScreeningRequestTypeValid(requestType)) {
    logger.error({ ctx }, requestType, 'validateRequestType did not find type');
    throw new ServiceError('ID_VALUE_FOR_REQUEST_TYPE_NOT_PRESENT');
  }
};

const CRIMINAL_CODE = 'CM';
const CREDIT_CODE = 'CR';

export const mapReportNametoFADVCode = {
  [ApplicantReportNames.CRIMINAL]: CRIMINAL_CODE,
  [ApplicantReportNames.CREDIT]: CREDIT_CODE,
};

const getApplicantProcessSummary = async (ctx, partyApplicationId, personId) => {
  const personApplication = await getPersonApplicationForScreening(ctx, partyApplicationId, personId);

  const { id: personApplicationId, partyId, applicationData: applicantDetails, additionalData } = personApplication;
  const { firstName, middleName, lastName } = applicantDetails;
  const applicantName = [firstName, middleName, lastName].filter(value => value).join(' ');

  const { incomeSourceHistory, addressHistory, disclosures } = additionalData;

  const pets = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.PET);
  const vehicles = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.VEHICLE);
  const children = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.CHILD);
  const insuranceChoice = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.INSURANCE_CHOICE);

  const privateDocuments = (await getDocumentsForPersonApplication(ctx, personApplicationId)).map(item => item.metadata);
  const sharedDocuments = (await getDocumentsByPartyApplicationIdService(ctx, partyApplicationId)).map(item => item.metadata);

  return {
    partyApplicationId,
    personId,
    applicantName,
    applicantDetails,
    incomeSourceHistory,
    addressHistory,
    privateDocuments,
    disclosures,
    children,
    pets,
    vehicles,
    sharedDocuments,
    insuranceChoice,
    applicationStatus: personApplication.applicationStatus,
  };
};

const getPersonIdsByMemberType = (members, memberType) => members.filter(member => member.memberType === memberType).map(member => member.personId);

const filterApplicantsByPersonIds = (applicants, personIds) => applicants.filter(applicant => personIds.includes(applicant.personId));

const getLatestQuotePromotion = (ctx, partyId) => getNonCanceledQuotePromotionByPartyId(ctx, partyId);

const getLeaseTerms = async (ctx, { partyId, quoteId }) => await getPublishedLeaseTermsByPartyIdAndQuoteId(ctx, { partyId, quoteId });

const getBaseRentAmount = (promotedLeaseTermId, leaseTerms) => {
  const promotedleaseTerm = leaseTerms.find(leaseTerm => leaseTerm.id === promotedLeaseTermId);
  if (!promotedleaseTerm) {
    return null;
  }

  return {
    rent: promotedleaseTerm.adjustedMarketRent,
    leaseTermMonths: promotedleaseTerm.termLength,
  };
};

const areApplicantsEqual = (applicants, applicantIds, personIds) =>
  applicants.length === applicantIds.length &&
  applicants.every(applicant => {
    if (applicant.applicantId) return applicantIds.some(applicantId => applicantId === applicant.applicantId);
    return personIds.some(personId => personId === applicant.personId);
  });

const isLeaseTermsDataEqual = (rentData, baseRent) =>
  parseFloat(rentData.rent) === parseFloat(baseRent.rent) && rentData.leaseTermMonths === baseRent.leaseTermMonths;

// TODO: rename this doAllScreeningsHaveAResponse (it includes incompletes as well)
export const areAllScreeningsCompleted = screeningResults => {
  if (!screeningResults.length) return false;
  const requestsLength = screeningResults.filter(screeningResult => screeningResult.rentData).length;
  const responsesLength = uniqBy(
    screeningResults.filter(screeningResult => screeningResult.status),
    'submissionRequestId',
  ).length;

  return requestsLength.length === responsesLength.length;
};

export const obscureApplicantProperties = obj => getSensitiveObject(obj);

export const obscurePreviousScreening = screening => {
  if (!(screening && screening.applicantsSsn)) return screening;

  return obscureObject(screening, Object.keys(screening.applicantsSsn));
};

/**
 * get the most recent screening result for the current promoted quote
 *
 *   @param tenantId {Guid} email information
 *   @param partyId {Guid} Tenant id
 *   @param screeningResults {Array} list of screening results
 *   @param allowUnmatched {Boolean} true to avoid match rent and lease months
 * @return {Object} return last screening result
 * */
export const getMostRecentScreeningResult = async (
  ctx,
  {
    partyId,
    applicantIds = [],
    personIds = [],
    screeningResults = [],
    allowUnmatched = false,
    leaseTermId,
    quoteId,
    createdAtOrderBy = 'created_at',
    returnAll,
  },
) => {
  let termId = leaseTermId;
  let quoteID = quoteId;

  if (!leaseTermId && !quoteId) {
    const quotePromotion = await getLatestQuotePromotion(ctx, partyId);

    if (quotePromotion) {
      quoteID = quotePromotion.quoteId;
      termId = quotePromotion.leaseTermId;
    }
  }

  const leaseTerms = await getLeaseTerms(ctx, { partyId, quoteId: quoteID });

  // 1. Get the base rent amount for the quote/term,
  const baseRentAmount = getBaseRentAmount(termId, leaseTerms) || {};

  // 2. Iterate through the rentData in each screeningRequest to find the one whose aplicants and rent amounts matches,
  let matchedScreeningResults = screeningResults.filter(
    screening =>
      screening.quoteId === quoteID &&
      isLeaseTermsDataEqual(screening.rentData, baseRentAmount) &&
      areApplicantsEqual(screening.applicantData.applicants, applicantIds, personIds),
  );

  if (allowUnmatched) {
    matchedScreeningResults = screeningResults;
  }
  // 3. Find the most recent screeningResponse for that request
  matchedScreeningResults = orderBy(matchedScreeningResults, createdAtOrderBy, 'desc');
  return returnAll ? matchedScreeningResults : matchedScreeningResults[0];
};

const splitBySpace = word =>
  word
    .toLowerCase()
    .split(' ')
    .filter(t => t);

const getPartyMemberByApplicantNameMatchingWordByWord = (applicantName, partyMembers = []) => {
  const tokensToSearch = splitBySpace(applicantName);
  const matchesCount = partyMembers.map(pm => {
    const tokens = splitBySpace(pm.fullName);
    return {
      id: pm.id,
      matchCount: tokensToSearch.filter(tts => tokens.includes(tts)).length,
    };
  });

  const result = matchesCount.reduce((acc, item) => (item.matchCount > acc.matchCount ? item : acc));
  if (result.matchCount === 0) return null;
  return partyMembers.find(pm => pm.id === result.id);
};

// CPM-10543
// This is to get around a FADV bug in which sometimes they place Customer under a Customers node, and sometimes they do not
export const customerFromApplicant = applicant => get(applicant, 'Customer[0]') || get(applicant, 'Customers[0].Customer[0]');
export const getPersonIdFromCustomerInfo = customer => get(customer, 'Identification[0].IDValue[0]');
export const getApplicantExternalId = applicantInformation => get(applicantInformation, 'Applicant[0].ExternalId[0]');

export const getMappedPartyMemberToApplicant = (ctx, { applicants, applicantsInformation, partyMembers, applicantId }) => {
  const applicantInformation = applicantsInformation.find(appl => appl.$.applicantid === applicantId);
  if (!applicantInformation) {
    logger.warn({ ctx, applicantId }, 'Missing applicant information from the FADV response');
    return null;
  }

  const applicant = applicants.find(appl => get(appl, 'AS_Information[0].ApplicantIdentifier[0]') === getApplicantExternalId(applicantInformation));
  if (applicant) {
    const customer = customerFromApplicant(applicant);
    const personId = getPersonIdFromCustomerInfo(customer);
    // Adding this in case the fake mode is on. Given that the fake response just sends an id of 1234560
    if (!isUuid(personId)) return { personId };

    return partyMembers.find(pm => pm.personId === personId);
  }

  const applicantName = get(applicantInformation, 'Applicant[0].ApplicantName[0]');
  logger.trace({ ctx, applicantName, applicantId }, 'using applicant name to match party member to applicant');
  if (!applicantName) return null;
  const exactMatch = partyMembers.find(pm => {
    if (!pm.fullName) return false;
    const name = removeEmptySpacesAndNonAlphanumeric(applicantName);
    const memberName = removeEmptySpacesAndNonAlphanumeric(pm.fullName);
    logger.trace({ ctx, name, memberName, applicantId }, 'getMappedPartyMemberToApplicant: Comparing names');
    return name.toLowerCase() === memberName.toLowerCase();
  });
  if (exactMatch) return exactMatch;
  return getPartyMemberByApplicantNameMatchingWordByWord(applicantName, partyMembers);
};

const getPersonIdFromApplicant = ({ applicants, applicantId, applicantsInformation }) => {
  const applicantInformation = applicantsInformation.find(appl => get(appl, '$.applicantid') === applicantId);
  const matchedApplicant = applicants.find(
    applicantSent => get(applicantSent, 'AS_Information[0].ApplicantIdentifier[0]') === getApplicantExternalId(applicantInformation),
  );
  if (!matchedApplicant) {
    logger.warn({ applicantId }, 'no match found for applicant, only should happen for old responses');
    return null;
  }
  const customer = customerFromApplicant(matchedApplicant);
  return getPersonIdFromCustomerInfo(customer);
};

const replaceScreeningApplicantIdentifierWithPersonId = (
  ctx,
  { applicantResults, applicants, applicantsInformation, applicantIdToPersonId },
  mappedPartyMembers,
) =>
  Object.keys(applicantResults).reduce((acc, screeningApplicantId = '') => {
    // CPM-8168 Temporary fix while problem with the applicantId returned from FADV is fixed
    // Keeping the split('_') so there is no problems with old data
    const resultId = screeningApplicantId.split('_');
    const applicantId = resultId && resultId[0];
    const [, , personId] = applicantId.split(':');

    if (personId) {
      acc[personId] = applicantResults[screeningApplicantId];
      return acc;
    }

    const member = mappedPartyMembers[applicantId];
    if (member) acc[member.personId] = applicantResults[screeningApplicantId];

    // CPM-11148, we get different values on node Curstomer.Identification.value from FADV responses,
    // on poll is personId and applicantIdentifier on push responses.
    // workaround: check if matchPersonId is applicant identifier otherwise it will a personId
    let matchPersonId = getPersonIdFromApplicant({ applicants, applicantId, applicantsInformation });
    const [, applicantIdFromCustomer] = (matchPersonId && matchPersonId.split(':')) || [];
    if (applicantIdFromCustomer && applicantIdToPersonId[applicantIdFromCustomer]) matchPersonId = applicantIdToPersonId[applicantIdFromCustomer];

    if (matchPersonId) {
      acc[matchPersonId] = applicantResults[screeningApplicantId];
      return acc;
    }
    return acc;
  }, {});

export const getApplicantsInformation = rawResponse =>
  get(rawResponse, 'ApplicantScreening.CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].ApplicationInformation[0].ApplicantInformation');

const getPartyMemberMappingObjFromCriteriaResults = (ctx, { criteriaResults, applicants, applicantsInformation, partyMembers }) => {
  const screeningApplicantIds = Object.keys(criteriaResults).reduce((acc, criteriaCode) => {
    const criteria = criteriaResults[criteriaCode];
    const { applicantResults = {} } = criteria;
    return [...acc, ...Object.keys(applicantResults)];
  }, []);

  return uniq(screeningApplicantIds).reduce((acc, screeningApplicantId) => {
    const resultId = screeningApplicantId.split('_');
    const applicantId = resultId && resultId[0];
    if (!applicantId) return acc;

    const partyMember = getMappedPartyMemberToApplicant(ctx, { applicants, applicantsInformation, partyMembers, applicantId });
    acc[applicantId] = partyMember;
    return acc;
  }, {});
};

export const getScreeningCriteriaAndResults = (ctx, rawResponse, criteriaResults, partyMembers, applicantIdToPersonId, partyId) => {
  const screeningCriterias = [];
  const screeningCriteriaResults = {};
  if (!criteriaResults) return { screeningCriterias, screeningCriteriaResults, allApplicantsHaveMatchInCriteriaResult: false };

  const applicantsInformation = getApplicantsInformation(rawResponse);

  if (!applicantsInformation) {
    logger.error({ partyId }, "Couldn't find Applicants Information");
  }
  const applicants = get(rawResponse, 'ApplicantScreening.Applicant');

  assert(applicants, 'getScreeningCriteriaAndResults: Missing applicants from FADV');

  const mappedPartyMembers = getPartyMemberMappingObjFromCriteriaResults(ctx, { criteriaResults, applicants, applicantsInformation, partyMembers });
  const unmatchedApplicants = Object.keys(mappedPartyMembers)
    .filter(screeningApplicantId => !mappedPartyMembers[screeningApplicantId])
    .map(screeningApplicantId => screeningApplicantId);
  const allApplicantsHaveMatchInCriteriaResult = !unmatchedApplicants.length;

  if (!allApplicantsHaveMatchInCriteriaResult) {
    logger.warn({ ctx, partyId, unmatchedApplicants: unmatchedApplicants.join(', ') }, 'One or more applicants could not be matched to active party members');
  }

  Object.keys(criteriaResults).forEach(criteriaCode => {
    const { criteriaId, criteriaType, criteriaDescription, applicantResults } = criteriaResults[criteriaCode];
    screeningCriterias.push({ criteriaId, criteriaType, criteriaDescription });
    screeningCriteriaResults[criteriaCode] =
      applicantResults &&
      applicantsInformation &&
      replaceScreeningApplicantIdentifierWithPersonId(ctx, { applicantResults, applicants, applicantsInformation, applicantIdToPersonId }, mappedPartyMembers);
  });

  return { screeningCriterias, screeningCriteriaResults, allApplicantsHaveMatchInCriteriaResult };
};

export const getScreeningCriteriaAndResultsForScreeningNotCompleted = partyMembers => {
  const criteriaId = newId();
  return {
    screeningCriterias: [
      {
        criteriaId,
        criteriaDescription: DALTypes.ScreeningCriteriaResult.SCREENING_NOT_COMPLETED,
      },
    ],
    screeningCriteriaResults: {
      [criteriaId]: partyMembers.reduce((acc, partyMember) => {
        acc[partyMember.personId] = FAIL_CRITERIA;
        return acc;
      }, {}),
    },
  };
};

export const getApplicantsFormattedFullname = (applicants = []) => applicants?.map(a => getFullName(a)).join(', ');

export const parsePartyApplicants = async (ctx, partyId, screeningApplicants = []) => {
  const { tenantId } = ctx;
  if (!tenantId || !partyId) {
    return { residents: [], guarantors: [] };
  }

  const partyMembers = await loadPartyMembers(ctx, partyId);

  const residentIds = getPersonIdsByMemberType(partyMembers, DALTypes.MemberType.RESIDENT);
  const guarantorIds = getPersonIdsByMemberType(partyMembers, DALTypes.MemberType.GUARANTOR);
  const occupantIds = getPersonIdsByMemberType(partyMembers, DALTypes.MemberType.OCCUPANT);

  return {
    residents: filterApplicantsByPersonIds(screeningApplicants, residentIds),
    guarantors: filterApplicantsByPersonIds(screeningApplicants, guarantorIds),
    occupants: filterApplicantsByPersonIds(screeningApplicants, occupantIds),
  };
};

export const getScreeningApplicants = async (ctx, screeningResult, partyId) => {
  screeningResult = screeningResult || {};
  const applicantData = screeningResult.applicantData || {};
  const { tenantId, applicants, partyApplicationId } = applicantData;
  const screeningApplicants = (applicants || []).map(applicant => ({
    tenantId,
    partyApplicationId,
    personId: applicant.personId,
  }));

  return parsePartyApplicants(ctx, partyId, screeningApplicants);
};

export const getPartyApplicants = async (ctx, partyId) => {
  const personApplications = await getPersonApplicationsByFilter(ctx, {
    partyId,
  });
  return parsePartyApplicants(ctx, partyId, personApplications);
};

export const getScreeningResultsByApplicants = async (ctx, applicants) => {
  if (!applicants || !applicants.length) return [];

  return await execConcurrent(applicants, async applicant => await getApplicantProcessSummary(ctx, applicant.partyApplicationId, applicant.personId));
};

export const parseScreeningApplicants = async (ctx, partyId, mostRecentScreeningResult) => {
  const partyApplicants = await (get(mostRecentScreeningResult, 'applicantData.applicants')
    ? getScreeningApplicants(ctx, mostRecentScreeningResult, partyId)
    : getPartyApplicants(ctx, partyId));

  const residents = await getScreeningResultsByApplicants(ctx, partyApplicants.residents);
  const guarantors = await getScreeningResultsByApplicants(ctx, partyApplicants.guarantors);
  const occupants = await getScreeningResultsByApplicants(ctx, partyApplicants.occupants);

  return { residents, guarantors, occupants };
};

const getLastUpdatedDates = key => (acc, item) => {
  if (!acc[item[key]]) {
    acc[item[key]] = item.updated_at;
    return acc;
  }
  if (acc[item[key]] < item.updated_at) {
    acc[item[key]] = item.updated_at;
  }
  return acc;
};

const getScreeningSummaryWarningsForApplicationUpdated = async (ctx, { partyId, earliestDateForScreening, mostRecentScreeningResult }) => {
  const warnings = [];
  const { applicants = [], partyApplicationId } = (mostRecentScreeningResult && mostRecentScreeningResult.applicantData) || {};

  const personApplications = await getPersonApplicationsByFilter(ctx, { partyId });

  const enhancedApplicants = applicants.reduce((acc, applicant) => {
    const personApplication = personApplications.find(pa => pa.personId === applicant.personId);
    if (!personApplication) return acc;
    acc[personApplication.id] = {
      partyApplicationId,
      personId: applicant.personId,
      name: applicant.firstName,
    };
    return acc;
  }, {});
  const personApplicationDocuments = await getPersonApplicationDocumentsByPartyId(ctx, partyId);
  const lastUpdatedDocuments = personApplicationDocuments
    .filter(personApplicationDocument => personApplicationDocument.updated_at > earliestDateForScreening)
    .reduce(getLastUpdatedDates('personApplicationId'), {});
  logger.trace({ lastUpdatedDocuments }, 'lastUpdatedDocuments');
  const lastUpdatedApplication = personApplications
    .filter(personApplication => personApplication.updated_at > earliestDateForScreening)
    .reduce(getLastUpdatedDates('id'), lastUpdatedDocuments);

  logger.trace({ lastUpdatedApplication }, 'lastUpdatedApplication');

  Object.keys(lastUpdatedApplication).forEach(personApplicationId => {
    warnings.push({
      message: 'APPLICATION_UPDATED',
      applicantName: (enhancedApplicants[personApplicationId] || {}).name,
      date: lastUpdatedApplication[personApplicationId],
    });
  });
  return warnings;
};

const getScreeningSummaryWarningsForScreeningUpdatedAfterPromotion = ({ earliestDateForScreening, screeningResults = {} }) => {
  const warnings = [];
  const mostRecentUpdate = maxBy(screeningResults, result => result.created_at);
  if (mostRecentUpdate && mostRecentUpdate.created_at > earliestDateForScreening) {
    warnings.push({
      message: 'SCREENING_RESULT_UPDATED',
      date: mostRecentUpdate.created_at,
    });
  }
  return warnings;
};

const getScreeningSummaryWarningsForInventoryOnHold = async (ctx, { quoteId, partyId }) => {
  const warnings = [];
  const inventory = await getInventoryForQuote(ctx, quoteId, ['id', 'name']);
  const [inventoryHold] = await getInventoryHolds(ctx, inventory.id);

  if (!inventoryHold || inventoryHold.partyId === partyId) return warnings;

  const agent = await loadUserById(ctx, inventoryHold.heldBy);
  warnings.push({
    message: 'UNIT_RESERVED_WARNING',
    agent: (agent && agent.fullName) || '',
    unitName: inventory.name,
    partyId: inventoryHold.partyId,
    componentType: SummaryWarningTypes.UNIT_RESERVED,
  });

  return warnings;
};

export const getMostRecentScreeningRequestByQuoteAndTermId = async (ctx, screeningRequests, quoteId, leaseTermId) => {
  const leaseTerm = (await getLeaseTermById(ctx, leaseTermId)) || {};

  const requestsByQuoteAndTerm =
    filter(screeningRequests, { rentData: { leaseNameId: leaseTerm.leaseNameId, leaseTermMonths: leaseTerm.termLength }, quoteId }) || [];

  return orderBy(requestsByQuoteAndTerm, 'created_at', 'desc')[0] || {};
};

export const getScreeningSummaryWarnings = async (ctx, { partyId, screeningResults, screeningRequests, mostRecentScreeningResult, quoteId, leaseTermId }) => {
  let quoteToPromoteId;
  let earliestDateForScreening;

  if (quoteId && leaseTermId) {
    const mostRecentRequestByQuoteAndTerm = await getMostRecentScreeningRequestByQuoteAndTermId(ctx, screeningRequests, quoteId, leaseTermId);
    earliestDateForScreening = mostRecentRequestByQuoteAndTerm.created_at;
    quoteToPromoteId = quoteId;
  } else {
    const promotedQuote = (await getLatestQuotePromotion(ctx, partyId)) || {};
    quoteToPromoteId = promotedQuote.quoteId;
    earliestDateForScreening = promotedQuote.created_at;
    logger.trace({ promotedQuote }, 'promotedQuote');
  }

  if (!quoteToPromoteId || !earliestDateForScreening) {
    logger.info({ ctx, quoteId, leaseTermId, partyId }, 'Missing quoteId/leaseTermId or promoted quote');
    return [];
  }
  const screeningSummaryWarningsForApplicationUpdated = await getScreeningSummaryWarningsForApplicationUpdated(ctx, {
    partyId,
    mostRecentScreeningResult,
    earliestDateForScreening,
  });

  let warnings = [].concat(screeningSummaryWarningsForApplicationUpdated);
  warnings = warnings.concat(
    getScreeningSummaryWarningsForScreeningUpdatedAfterPromotion({
      earliestDateForScreening,
      screeningResults,
    }),
  );

  warnings = warnings.concat(await getScreeningSummaryWarningsForInventoryOnHold(ctx, { quoteId: quoteToPromoteId, partyId }));

  return warnings;
};

// TODO: related to CPM-4766
// Use decision service instead of this mock data
// The signature reflects the expected final signature of this function.
const getScreeningRecommendedConditions = (screeningResult = {}) => screeningResult.recommendations || [];

const RECOMMENDED_DECLINE_CODES = []; // FIXME this list have never been updated with real codes, problably is not longer needed
const isDeclineCode = criteriaCode => RECOMMENDED_DECLINE_CODES.indexOf(criteriaCode) >= 0;
const resultIsFail = passFail => passFail === FAIL_CRITERIA;
const shouldDecline = (criteriaCode, { passFail }) => resultIsFail(passFail) && isDeclineCode(criteriaCode);

// TODO: this should probably be calculated at screening time instead at summary-generation time
// potentially a decision to replace the FADV-provided one based on analysis of the specific criteria results.  If
// it returns null, then the FADV-provided decision will be used
// criteriaResult is a map in the format:
// { <criteriaCode> : { passFail: 'P',... } }
export const getApplicationDecisionByCriteria = criteriaResultMap => {
  if (!criteriaResultMap) return null;
  const criteriaResults = Object.entries(criteriaResultMap);
  return criteriaResults.some(([code, result]) => shouldDecline(code, result))
    ? // DALTypes.CustomScreeningDecision.RECOMMENDED_DECLINE : null;
      // until we get better understanding of how to distinguish between FADV decision types and custom decision types,
      // we will simply update the decision instead of adding a new decision type
      ScreeningDecision.DECLINED
    : null;
};

const getOverrideDecisionForGuarantorRequired = (applicationDecision, didApplicationHaveGuarantor) => {
  if (applicationDecision === ScreeningDecision.GUARANTOR_REQUIRED && didApplicationHaveGuarantor) {
    return ScreeningDecision.GUARANTOR_DENIED;
  }
  return null;
};

const CUSTOM_RECOMMENDATIONS = {
  HAVE_DISCLOSURES: {
    id: '15000',
    // TODO: We're using regular text from now, once we set i18n for FADV override codes, we should change this too.
    text: 'Check the information disclosed by the applicants before taking a decision.',
  },
};

/*
 * Screening criteria have this format:
 * {"302":{"69318a15-d157-41b3-8f8e-4098c98c5963":"P"},"303":{"69318a15-d157-41b3-8f8e-4098c98c5963":"P"}}
 * this method will extract the person Id into an array
 */
const getPersonsFromScreeningCriteriaResults = screeningCriteriaResults =>
  [].concat(...Object.values(screeningCriteriaResults).reduce((acc, item) => acc.concat(...Object.keys(item)), []));

const getEnhancedScreeningsForIncompleteScreening = (
  ctx,
  screeningResult,
  customApplicationDecision,
  recommendedConditions,
  partyMembers,
  applicantIdToPersonId,
  partyId,
) => {
  logger.trace({ ctx }, 'getEnhancedScreeningsForIncompleteSCreening');
  const { screeningCriterias, screeningCriteriaResults } = getScreeningCriteriaAndResults(
    ctx,
    screeningResult.rawResponse,
    screeningResult.criteriaResult,
    partyMembers,
    applicantIdToPersonId,
    partyId,
  );

  const allCriteriaResults = getPersonsFromScreeningCriteriaResults(screeningCriteriaResults);
  const criteriaAwaitingForScreeningId = newId();
  const { Response = [{}] } = screeningResult?.rawResponse?.ApplicantScreening || {};
  const blockedStatus = Response[0].BlockedStatus && Response[0].BlockedStatus[0];

  screeningCriterias.push({
    criteriaId: criteriaAwaitingForScreeningId,
    criteriaDescription: DALTypes.ScreeningCriteriaResult.AWAITING_SCREENING_FOR_APPLICANT,
  });

  partyMembers.forEach(partyMember => {
    const displayName = getDisplayName(partyMember, { usePreferred: true });
    if (allCriteriaResults.some(personId => personId === partyMember.personId)) {
      recommendedConditions.push({
        id: newId(),
        text: `Screening completed for ${displayName}`,
      });
      screeningCriteriaResults[criteriaAwaitingForScreeningId] = {
        [partyMember.personId]: FAIL_CRITERIA,
      };
    } else {
      recommendedConditions.push({
        id: newId(),
        text: `Awaiting screening for ${displayName}`,
      });
    }
  });

  return {
    ...omit(screeningResult, 'rawResponse'),
    applicationDecision: ScreeningDecision.SCREENING_IN_PROGRESS,
    screeningCriterias,
    screeningCriteriaResults,
    customApplicationDecision,
    recommendedConditions,
    blockedStatus,
  };
};

const hasThinFile = ({ applicantDecision = [] }) =>
  (applicantDecision || []).some(({ creditAssessment }) => creditAssessment === DALTypes.CreditAssessmentTypes.THIN_FILE);

// return screeningResults enhanced with recommendedConditions and with customApplicationDecision
export const getEnhancedScreenings = (ctx, screeningResults, wereDisclosuresSelected, partyMembers, applicantIdToPersonId, partyId) => {
  screeningResults = screeningResults || [];
  partyMembers = partyMembers || [];
  logger.trace({ ctx, numScreeningResults: screeningResults.length, wereDisclosuresSelected, numPartyMembers: partyMembers.length }, 'getEnhancedScreenings');

  return screeningResults.map(screeningResult => {
    if (!screeningResult.status && screeningResult.applicationDecision !== ScreeningDecision.ERROR_ADDRESS_UNPARSABLE) {
      return {
        ...screeningResult,
        applicationDecision: ScreeningDecision.RESULTS_DELAYED,
      };
    }

    const applicants = get(screeningResult, 'applicantData.applicants');
    const didApplicationHaveGuarantor = applicants && applicants.some(applicant => applicant.type === DALTypes.MemberType.GUARANTOR);
    const overrideDecisionForGuarantorRequired = getOverrideDecisionForGuarantorRequired(screeningResult.applicationDecision, didApplicationHaveGuarantor);
    const applicationDecisionByCriteria = getApplicationDecisionByCriteria(screeningResult.criteriaResult);
    const customApplicationDecision = overrideDecisionForGuarantorRequired || applicationDecisionByCriteria;
    const hasCreditThinFile = hasThinFile(screeningResult);

    const recommendedConditions = getScreeningRecommendedConditions(screeningResult);

    if (wereDisclosuresSelected) {
      recommendedConditions.push(CUSTOM_RECOMMENDATIONS.HAVE_DISCLOSURES);
      if (screeningResult.applicationDecision.toLowerCase() === ScreeningDecision.APPROVED) {
        screeningResult.applicationDecision = ScreeningDecision.APPROVED_WITH_COND;
      }
    }

    if (screeningResult.status !== FADV_RESPONSE_STATUS.INCOMPLETE && screeningResult.status !== FADV_RESPONSE_STATUS.INCOMPLETE_INCORRECT_MEMBERS) {
      const { screeningCriterias, screeningCriteriaResults, allApplicantsHaveMatchInCriteriaResult = true } = screeningResult.criteriaResult
        ? getScreeningCriteriaAndResults(ctx, screeningResult.rawResponse, screeningResult.criteriaResult, partyMembers, applicantIdToPersonId, partyId)
        : getScreeningCriteriaAndResultsForScreeningNotCompleted(partyMembers);
      return {
        ...omit(screeningResult, 'rawResponse'),
        screeningCriterias,
        screeningCriteriaResults,
        customApplicationDecision,
        recommendedConditions,
        allApplicantsHaveMatchInCriteriaResult,
        isExpired: now().diff(toMoment(screeningResult.applicationCreatedAt), 'days') > APPLICATION_EXPIRATION_DAYS,
        hasCreditThinFile,
      };
    }
    return getEnhancedScreeningsForIncompleteScreening(
      ctx,
      screeningResult,
      customApplicationDecision,
      recommendedConditions,
      partyMembers,
      applicantIdToPersonId,
      partyId,
      hasCreditThinFile,
    );
  });
};

// See CPM-9266
// Q: when is this used?  why?  shouldn't it be in the module that uses it?
export const replacePersonIdOnApplicantsIfNeeded = (screeningResponse = {}, personApplications = []) => {
  const applicantData = screeningResponse.applicantData || {};

  if (Array.isArray(applicantData.applicants)) {
    applicantData.applicants = applicantData.applicants.map(applicant => {
      const personApplication = personApplications.find(pa => pa.applicantId === applicant.applicantId) || {};
      const { personId } = personApplication;

      return personId
        ? {
            ...applicant,
            personId,
          }
        : applicant;
    });
  }
  return {
    ...screeningResponse,
    applicantData,
  };
};

export const enhanceScreeningWithHasNoPendingResponsesFlag = ({ screeningResults }) =>
  screeningResults.map(screeningResult => ({
    ...screeningResult,
    hasNoPendingResponses: !!screeningResult.id, // this is the submissionResponse id (returned by the outer join)
  }));

export const applicationDecisionHasErrorOther = applicationDecision => (applicationDecision && applicationDecision === ScreeningDecision.ERROR_OTHER) || false;

export const obscureFadvRawRequestData = (xml = '') => {
  const { matchers, replacer } = getSensitiveXmlDataMatchers(['UserPassword', 'SocSecNumber']);
  matchers.forEach(matcher => {
    xml = xml.replace(matcher, replacer);
  });

  return xml;
};

export const getScreeningVersion = async ctx => {
  const { tenantId, partyId, screeningVersion } = ctx;
  logger.trace({ ctx, partyId, screeningVersion }, 'getScreeningVersion');

  if (screeningVersion) return screeningVersion;

  assert(tenantId, 'getScreeningVersion: No tenant id found');
  const { metadata: partyMetadata } = (partyId && (await loadPartyById(ctx, partyId))) || {};

  if (partyMetadata && partyMetadata.screeningVersion) {
    logger.trace({ ctx, partyId, screeningVersion: partyMetadata.screeningVersion }, 'Got screening version using party id');
    return partyMetadata.screeningVersion;
  }

  const tenantScreeningVersion = await getTenantScreeningVersion(ctx, tenantId);
  logger.trace({ ctx, screeningVersion: tenantScreeningVersion }, 'Got screening version using tenant id');
  return tenantScreeningVersion;
};

export const maskSsnInSubmissionResponse = submissionResponse => {
  const rawResponse = submissionResponse.rawResponse;
  if (!rawResponse.ApplicantScreening || !rawResponse.ApplicantScreening.Applicant) return submissionResponse;
  // Question: this is mutating the data. Is this intentional?
  rawResponse.ApplicantScreening.Applicant.forEach(applicant => {
    if (applicant.AS_Information[0].SocSecNumber && applicant.AS_Information[0].SocSecNumber[0]) {
      // We expect that FADV already masks this field in their response, but masking here just in case.
      applicant.AS_Information[0].SocSecNumber[0] = maskSSNWithX(applicant.AS_Information[0].SocSecNumber[0]);
    }
  });

  return { ...submissionResponse, rawResponse };
};

export const maskSubmissionResponse = submissionResponse => {
  if (!submissionResponse.rawResponse) return submissionResponse;

  const maskedResponse = maskSsnInSubmissionResponse(submissionResponse);
  const { rawResponse = {} } = submissionResponse;
  if (!rawResponse.ApplicantScreening || !rawResponse.ApplicantScreening.Request) return maskedResponse;

  rawResponse.ApplicantScreening.Request.forEach(request => {
    if (request.UserPassword && request.UserPassword[0]) {
      request.UserPassword[0] = OBSCURE_VALUE;
    }
  });

  return { ...maskedResponse, rawResponse };
};

const getApplicantName = applicantInformation => get(applicantInformation, 'Applicant[0].ApplicantName[0]', '');

export const logMismatchedApplicants = async (ctx, partyId, reportId, missingApplicants = []) => {
  if (!missingApplicants.length) return;
  const partyUrl = await getPartyUrl(ctx, partyId);
  const missingApplicantNames = missingApplicants.map(applicantInformation => getApplicantName(applicantInformation));
  logger.error({ ctx, partyUrl, missingPartyMembers: missingApplicantNames.join(', '), reportId }, 'Mismatched applicants detected');
};

export const formatApplicantsCreditScore = (applicantsIdMap = {}, rentIcomesApplicants = []) =>
  rentIcomesApplicants.reduce(
    (acc, applicant) => {
      Object.keys(applicantsIdMap).forEach(key => {
        if (applicant.ApplicantID[0] !== key) return;

        const parsedCreditScore = parseInt((applicant.CreditScore || [])[0], 10);
        let creditAssessment = DALTypes.CreditAssessmentTypes.NO_FILE;

        if (parsedCreditScore === 0) {
          creditAssessment = DALTypes.CreditAssessmentTypes.THIN_FILE;
        }

        if (parsedCreditScore > 0) {
          creditAssessment = DALTypes.CreditAssessmentTypes.HAS_CREDIT;
        }

        const creditScore = !isNaN(parsedCreditScore) && parsedCreditScore;
        const applicantsInfo = {
          creditScore,
          creditAssessment,
          applicantId: applicantsIdMap[key],
        };

        acc.push(applicantsInfo);
      });

      return acc;
    },
    [{}],
  );
