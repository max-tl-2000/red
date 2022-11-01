/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import find from 'lodash/find';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import orderBy from 'lodash/orderBy';
import intersectionBy from 'lodash/intersectionBy';
import loggerModule from '../../../../common/helpers/logger';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { loadPartyById } from '../../../../server/services/party';
import { getPropertyAssignedToParty } from '../../../../server/helpers/party';
import { canMemberBeInvitedToApply } from '../../../../common/helpers/quotes';
import { updatePartyApplication as updatePartyApplicationInDAL } from '../../dal/party-application-repo';
import { getPersonApplicationsByPartyId, getPersonApplicationsByApplicantIds, enableSSNSubmissionForApplicants } from '../../dal/person-application-repo';
// TODO: convert these external DAL calls to service calls!
import { loadPartyMembers } from '../../../../server/dal/partyRepo';
import { getPropertySettings } from '../../../../server/dal/propertyRepo';
import { getScreeningAddress } from '../../screening/fadv/applicant-data-parser';
import { getLeaseNameById } from '../../../../server/dal/leaseTermRepo';
import { getUnitAddress } from '../../../../common/helpers/addressUtils';
// TODO: rentapp is not allowed to make requests to Inventory DAL
import { getInventoryById, getFirstCreatedInventoryForProperty } from '../../../../server/dal/inventoryRepo';
import { getPublishQuotesData } from '../../../../server/services/quotes';
import { NoRetryError } from '../../../../server/common/errors';
import { getRentDataList } from '../../screening/screening-helper';
import { getScreeningCriteriaAndResults, getApplicantsInformation, getApplicantExternalId } from '../../helpers/screening-helper';
import { FADV_RESPONSE_STATUS } from '../../../common/screening-constants';
import { FADV_RESPONSE_CUSTOM_RECORDS, mapApplicantIds } from '../../screening/fadv/screening-report-parser.ts';
import { mapApplicantIdToPersonId, APPLICANT_TYPE_APPLICANT, APPLICANT_TYPE_OCCUPANT, APPLICANT_TYPE_GUARANTOR } from '../../helpers/base-fadv-helper';
import nullish from '../../../../common/helpers/nullish';
import { ScreeningResponseOrigin } from '../../helpers/applicant-types';
import { createReportDataBuilder } from './v2/helpers/fadv-helper';
import { getPreviousTenantIdFromLatestNewRequest as getPreviousTenantIdFromLatestNewRequestRepo } from '../../dal/fadv-submission-repo';
import { sortObject } from '../../../../common/helpers/object-utils';

const logger = loggerModule.child({ subType: 'Application Screening Handler' });

export const getScreeningUnitAddress = async (ctx, { propertyId }) => {
  if (!propertyId) return null;
  const { id } = await getFirstCreatedInventoryForProperty(ctx, propertyId);
  const inventory = await getInventoryById(ctx, { id, expand: true });
  const getUnitAddressForProperty = getUnitAddress(inventory.property.name);
  return getUnitAddressForProperty(inventory);
};

export const getScreeningPropertyId = async (ctx, { partyId, leaseNameId }) => {
  if (leaseNameId) {
    const leaseName = await getLeaseNameById(ctx, leaseNameId);
    const propertyId = leaseName.propertyId;
    if (propertyId) return propertyId;
  }

  const party = await loadPartyById(ctx, partyId);
  return ((await getPropertyAssignedToParty(ctx, party)) || {}).id;
};

/* Get highest rent between all rent lease Term */
const pickHighestMonthlyRent = (rentLeaseTerms = []) =>
  rentLeaseTerms.reduce((prev, rentLeaseTerm) => {
    if (parseFloat(rentLeaseTerm.rent) > parseFloat(prev.rent)) {
      prev = rentLeaseTerm;
    }
    return prev;
  });

// export is for testing only
export const getHighestMonthlyRentFromQuotes = quotes => {
  const list = getRentDataList(quotes);
  return pickHighestMonthlyRent(list);
};

export const getRentData = async (ctx, partyId) => {
  let publishQuotesData = [];
  try {
    publishQuotesData = await getPublishQuotesData(ctx, partyId);
  } catch (err) {
    const errorMsg = 'Unable to get publishQuotesData';
    logger.error({ ctx, partyId, err }, errorMsg);
    throw new NoRetryError(errorMsg);
  }

  if (!publishQuotesData.length) {
    const errorMessage = 'there are not published quotes';
    const propertyId = await getScreeningPropertyId(ctx, { partyId });
    logger.error({ ctx, partyId, propertyId }, errorMessage);
    throw new NoRetryError(errorMessage);
  }

  logger.trace({ quoteIds: publishQuotesData.map(q => q.id) }, 'get rentData got quotes');
  return getHighestMonthlyRentFromQuotes(publishQuotesData);
};

const PARTYMEMBER_TO_APPLICANT = {
  [DALTypes.MemberType.RESIDENT]: APPLICANT_TYPE_APPLICANT,
  [DALTypes.MemberType.OCCUPANT]: APPLICANT_TYPE_OCCUPANT,
  [DALTypes.MemberType.GUARANTOR]: APPLICANT_TYPE_GUARANTOR,
};

export const getApplicants = (ctx, { partyMemberAndPersonApplicationList, unitAddress, options = {} }) => {
  const { tenantId } = ctx;
  const shouldReplaceApplicantsIntlAddrWithPropertyAddr = options.shouldReplaceApplicantsIntlAddrWithPropertyAddr || false;
  return partyMemberAndPersonApplicationList.map(item => {
    const applicant = {
      ...item.personApplication.applicationData,
      applicantId: item.personApplication.applicantId,
      personId: item.partyMember.personId,
      type: PARTYMEMBER_TO_APPLICANT[item.partyMember.memberType],
      sendSsnEnabled: item.personApplication.sendSsnEnabled,
    };

    if ((applicant.ssn || applicant.itin) && applicant.sendSsnEnabled) applicant.socSecNumber = applicant.ssn || applicant.itin;
    delete applicant.ssn;
    delete applicant.itin;

    if (
      shouldReplaceApplicantsIntlAddrWithPropertyAddr &&
      applicant.haveInternationalAddress &&
      item.partyMember.memberType !== DALTypes.MemberType.GUARANTOR &&
      unitAddress
    ) {
      applicant.address = getScreeningAddress({ ...unitAddress, zip: unitAddress.postalCode });
      applicant.haveInternationalAddress = false;
    }

    if (item.partyMember.memberType === DALTypes.MemberType.GUARANTOR) {
      const guaranteedMembers = partyMemberAndPersonApplicationList.filter(
        ({ partyMember }) => partyMember.guaranteedBy && item.partyMember.id && partyMember.guaranteedBy === item.partyMember.id,
      );
      applicant.guarantorFor = guaranteedMembers.map(({ personApplication }) => `${tenantId}:${personApplication.applicantId}`).join('^');
    }

    return applicant;
  });
};

/**
 * Get the SubmissionRequestId from the parsed Response.
 *
 * @param {Object} response - parsed Response
 * @return {string} submissionRequestId - The Submission request id to link to the response.
 *
 */
export const getSubmissionRequestId = (ctx, { customRecords }) => {
  if (customRecords && customRecords[FADV_RESPONSE_CUSTOM_RECORDS.SCREENING_REQUEST_ID]) {
    return customRecords[FADV_RESPONSE_CUSTOM_RECORDS.SCREENING_REQUEST_ID];
  }
  logger.error({ ctx }, 'getSubmissionRequestId Missing customRecords on screening response');
  throw new Error('Missing customRecords on screening response');
};

/**
 * Update the party application
 * @param {string} tenantId - XML string sent from FADV
 * @param {string} partyApplicationId - XML string sent from FADV
 * @param {Object} response - response after processing
 * @param {string} ApplicantScreening - node from parsed FADV response (used to extract rent info that was requested)
 * @return {Object} updated PartyApplication object in DB
 */
export const updatePartyApplicationObject = async (ctx, partyApplicationId, { MonthlyRent, ApplicationDecision }) => {
  const updatePartyApplicationResult = await updatePartyApplicationInDAL(ctx, partyApplicationId, ApplicationDecision, MonthlyRent);
  logger.trace({ ctx, updatePartyApplicationResult }, 'updatePartyApplicationObject');

  return updatePartyApplicationResult;
};

export const getPersonIdsByParty = async (tenantId, partyId) => {
  const partyMembers = await loadPartyMembers({ tenantId }, partyId);
  return partyMembers.filter(canMemberBeInvitedToApply).map(member => member.personId);
};

export const getPropertyIncomePolicies = async (ctx, propertyId) => {
  const propertySettings = await getPropertySettings(ctx, propertyId);
  return (
    (propertySettings && propertySettings.screening) || {
      incomePolicyRoommates: DALTypes.IncomePolicyRoommates.INDIVIDUAL,
      incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.INDIVIDUAL,
    }
  );
};

export const checkApplicantsRoleChange = (partyMembers = [], applicants = []) => {
  if (!partyMembers.length || !applicants.length) return false;
  return partyMembers.some(pm => {
    const applicant = find(applicants, appl => appl.personId === pm.personId);
    return applicant && applicant.type !== PARTYMEMBER_TO_APPLICANT[pm.memberType];
  });
};

export const checkApplicantsRemoved = (inactivePartyMembers = [], lastSentApplicants = []) => {
  if (!inactivePartyMembers.length || !lastSentApplicants.length) return false;
  return inactivePartyMembers.some(pm => lastSentApplicants.find(appl => appl.personId === pm.personId));
};

const areScalarValuesInResponseEqual = (previousResponse, currentResponse, fieldName) => {
  if (nullish(previousResponse[fieldName]) && nullish(currentResponse[fieldName])) return true;
  return previousResponse[fieldName] === currentResponse[fieldName];
};

// Compare a & b, but treat a = null and b = undefined as equal
const isEqualOrBothEmpty = (a, b) => (!a && !b) || isEqual(a, b);

const getOrderedApplicantDecisions = (prev, current) => {
  const orderedPrevApplicantDecision = orderBy(prev, ['applicantId']).map(appDec => sortObject(appDec));
  const orderedCurrentApplicantDecision = orderBy(current, ['applicantId']).map(appDec => sortObject(appDec));

  return {
    orderedPrevApplicantDecision,
    orderedCurrentApplicantDecision,
  };
};

const screeningResponsesHaveSameResult = (ctx, submissionRequestId, previousResponse, currentResponse) => {
  const isSameApplicationDecision = areScalarValuesInResponseEqual(previousResponse, currentResponse, 'applicationDecision');
  const { orderedPrevApplicantDecision, orderedCurrentApplicantDecision } = getOrderedApplicantDecisions(
    previousResponse.applicantDecision,
    currentResponse.applicantDecision,
  );
  const isSameApplicantDecision = isEqualOrBothEmpty(orderedPrevApplicantDecision, orderedCurrentApplicantDecision);

  const sameDecision = isSameApplicationDecision && isSameApplicantDecision;
  if (!sameDecision) {
    const applicantDecisions = !isSameApplicantDecision
      ? {
          previousApplicantDecision: orderedPrevApplicantDecision,
          currentApplicantDecision: orderedCurrentApplicantDecision,
        }
      : {};

    logger.debug(
      {
        ctx,
        isSameApplicationDecision,
        isSameApplicantDecision,
        ...applicantDecisions,
        submissionRequestId,
      },
      'screeningResponsesHaveSameResult: differences in screening decision!',
    );
    return false;
  }

  const isSameCriteriaResults = isEqualOrBothEmpty(previousResponse.criteriaResult, currentResponse.criteriaResult);
  if (!isSameCriteriaResults) {
    logger.debug(
      {
        ctx,
        submissionRequestId,
        previousCriteriaResult: previousResponse.criteriaResult,
        currentCriteriaResult: currentResponse.criteriaResult,
      },
      'screeningResponsesHaveSameResult: differences in criteria results!',
    );
    return false;
  }

  const isSameServiceStatus = isEqualOrBothEmpty(previousResponse.serviceStatus, currentResponse.serviceStatus);
  if (!isSameServiceStatus) {
    logger.debug({ ctx, submissionRequestId }, 'screeningResponsesHaveSameResult: differences in service status!');
    return false;
  }

  const isSameBackgroundReport = areScalarValuesInResponseEqual(previousResponse, currentResponse, 'backgroundReport');
  if (!isSameBackgroundReport) {
    logger.debug({ ctx, submissionRequestId }, 'screeningResponsesHaveSameResult: differences in background report!');
    return false;
  }

  return true;
};

const shouldStorePushedScreeningResponse = (submissionResponse, lastStoredResponse) => {
  if (!lastStoredResponse || !submissionResponse) return false;

  const { origin: lastStoredResponseOrigin } = lastStoredResponse;
  const { origin: currentResponseOrigin } = submissionResponse;

  if (!lastStoredResponseOrigin || currentResponseOrigin !== ScreeningResponseOrigin.PUSH) return false;
  if (lastStoredResponseOrigin !== ScreeningResponseOrigin.POLL) return false;

  return true;
};

export const shouldStoreScreeningResponse = (ctx, { submissionRequestId, submissionResponse, lastStoredResponse }) => {
  if (!lastStoredResponse) return true;
  logger.debug({ ctx, submissionRequestId, previousResponseId: lastStoredResponse.id }, 'shouldStoreScreeningResponse');
  const currentResponseHasBackgroundReport = !isEmpty(submissionResponse.backgroundReport);

  if (!currentResponseHasBackgroundReport) {
    logger.debug({ ctx, submissionRequestId }, 'Screening response does not have a background report!');
    return false;
  }

  if (shouldStorePushedScreeningResponse(submissionResponse, lastStoredResponse)) {
    const { id: lastStoredResponseId, origin: lastStoredResponseOrigin = ScreeningResponseOrigin.HTTP } = lastStoredResponse;
    logger.debug({ ctx, submissionRequestId, lastStoredResponseId, lastStoredResponseOrigin }, 'Storing pushed response after a view request');
    return true;
  }

  return !screeningResponsesHaveSameResult(ctx, submissionRequestId, lastStoredResponse, submissionResponse);
};

const doAllApplicantsHaveDecision = (ctx, applicants, applicantDecision) => {
  if (applicants.length !== applicantDecision.length) {
    logger.error({ ctx }, 'doAllApplicantsHaveDecision sent applicants do not match the applicants in the response');
    throw new Error('Sent applicants do not match the applicants in the response');
  }

  return applicants.every(
    ({ applicantId, personId }) =>
      applicantDecision && applicantDecision.some(decision => decision.applicantId === applicantId || decision.personId === personId),
  );
};

const doApplicantsMatchCriteriaResult = async (ctx, { excludeInactive, partyId, applicants, criteriaResult, rawResponse }) => {
  if (!criteriaResult) return false;

  const partyMembers = await loadPartyMembers(ctx, partyId, { excludeInactive });
  const partyMembersThatAreApplicants = intersectionBy(partyMembers, applicants, 'personId');
  const personApplications = await getPersonApplicationsByPartyId(ctx, partyId);
  const applicantIdToPersonId = mapApplicantIdToPersonId(personApplications);
  const { allApplicantsHaveMatchInCriteriaResult } = getScreeningCriteriaAndResults(
    ctx,
    rawResponse,
    criteriaResult,
    partyMembersThatAreApplicants,
    applicantIdToPersonId,
    partyId,
  );
  return allApplicantsHaveMatchInCriteriaResult;
};

export const isScreeningComplete = async (ctx, partyId, applicantData, { status, applicationDecision, applicantDecision, criteriaResult, rawResponse }) => {
  if (status !== FADV_RESPONSE_STATUS.COMPLETE) return false;

  const hasApplicationDecision = !!applicationDecision;

  return (
    hasApplicationDecision &&
    doAllApplicantsHaveDecision(ctx, applicantData.applicants, applicantDecision) &&
    (await doApplicantsMatchCriteriaResult(ctx, {
      partyId,
      applicants: applicantData.applicants,
      criteriaResult,
      rawResponse,
    }))
  );
};

export const getMismatchedApplicantsFromResponse = (ctx, { rawResponse }, applicants = []) => {
  if (!applicants.length) {
    logger.trace({ ctx }, 'getMismatchedApplicantsFromResponse skipping check because applicants array was empty');
    return [];
  }
  const applicantsInResponse = getApplicantsInformation(rawResponse) || applicants;
  logger.trace({ ctx, applicantsInResponse, applicants }, 'getMismatchedApplicantsFromResponse applicant compare');
  if (applicants.length !== applicantsInResponse.length) {
    logger.trace(
      { ctx, applicantsLength: applicants.length, applicantsInResponseLength: applicantsInResponse.length },
      'getMismatchedApplicantsFromResponse lengths are different',
    );
    return applicantsInResponse.filter(applicantInformation => {
      const applicantExternalId = getApplicantExternalId(applicantInformation);
      const [, applicantId] = applicantExternalId.split(':');
      const didFindApplicationMember = !applicants.some(app => app.applicantId === applicantId);
      logger.info({ ctx, applicantExternalId, didFindApplicationMember }, 'getMismatchedApplicantsFromResponse looking for member');
      return didFindApplicationMember;
    });
  }

  return [];
};

export const incompleteIncorrectMembersExist = (ctx, partyId, applicants, { status, rawResponse }) => {
  const mismatchedApplicants = getMismatchedApplicantsFromResponse(ctx, { rawResponse }, applicants);
  const doesResponseHaveIncorrectMembers = status === FADV_RESPONSE_STATUS.COMPLETE && mismatchedApplicants.length > 0;
  if (doesResponseHaveIncorrectMembers) {
    logger.error({ ctx, partyId, applicants, responseStatus: status, mismatchedApplicants }, 'incompleteIncorrectMembersExist');
  }
  return doesResponseHaveIncorrectMembers;
};

export const buildApplicantsToEnableSsnSubmission = async (ctx, response) => {
  const defaultResult = {
    enableSsnSubmission: false,
    updateApplicants: () => ({}),
  };

  const applicantIdHash = mapApplicantIds(ctx, response.ApplicantScreening);

  if (isEmpty(applicantIdHash)) return defaultResult;
  const personApplications = await getPersonApplicationsByApplicantIds(ctx, Object.values(applicantIdHash));
  if (personApplications.length !== 0 && personApplications.every(pa => pa.sendSsnEnabled)) return defaultResult;

  const reportBuilder = createReportDataBuilder(ctx, response, logger);

  const applicantsToEnableSsnSubmission = Object.keys(applicantIdHash).reduce((acc, screeningApplicantId) => {
    const personApplication = personApplications.find(pa => pa.applicantId === applicantIdHash[screeningApplicantId]);
    if (!personApplication || personApplication.sendSsnEnabled) return acc;

    const { hasRequiredSsnResponse, hasSuspiciousSsn, hasNoEstablishedCredit, creditScore } = reportBuilder.buildCreditReport(screeningApplicantId);
    const shouldEnableSsnSubmission = hasNoEstablishedCredit || creditScore === 0 || hasSuspiciousSsn || hasRequiredSsnResponse;

    return shouldEnableSsnSubmission
      ? acc.concat({
          hasNoEstablishedCredit,
          creditScore,
          hasSuspiciousSsn,
          hasRequiredSsnResponse,
          screeningApplicantId,
          personApplicationId: personApplication.id,
        })
      : acc;
  }, []);

  const enableSsnSubmission = !!applicantsToEnableSsnSubmission.length;
  enableSsnSubmission && logger.debug({ ctx, applicantsToEnableSsnSubmission }, 'buildApplicantsToEnableSsnSubmission: should enable automatically submission');
  return {
    enableSsnSubmission,
    updateApplicants: async () => {
      if (!enableSsnSubmission) return;

      const personApplicationIds = applicantsToEnableSsnSubmission.map(it => it.personApplicationId);
      logger.debug({ ctx, personApplicationIds }, 'buildApplicantsToEnableSsnSubmission: enabling ssn submission');
      await enableSSNSubmissionForApplicants(ctx, personApplicationIds);
    },
  };
};

export const getPreviousTenantIdFromLatestNewRequest = async (ctx, applicantId) => await getPreviousTenantIdFromLatestNewRequestRepo(ctx, applicantId);
