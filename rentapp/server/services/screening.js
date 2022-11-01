/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import omit from 'lodash/omit';
import { mapSeries } from 'bluebird';
import maxBy from 'lodash/maxBy';
import { t } from 'i18next';
import { ServiceError, NoRetryError } from '../../../server/common/errors';
import { badRequestErrorIfNotAvailable } from '../../../common/helpers/validators';
import * as dal from '../dal/fadv-submission-repo';
import * as applicantReportDal from '../dal/applicant-report-repo';
import { getPropertyTimezone } from '../../../server/dal/propertyRepo';
import {
  areAllScreeningsCompleted,
  getMostRecentScreeningResult,
  parseScreeningApplicants,
  getScreeningSummaryWarnings,
  getEnhancedScreenings,
  enhanceScreeningWithHasNoPendingResponsesFlag,
  replacePersonIdOnApplicantsIfNeeded,
  applicationDecisionHasErrorOther,
} from '../helpers/screening-helper';
import { loadPartyById, loadPartyMembers } from '../../../server/services/party';
import { getPersonApplicationsByPartyId, getPersonApplicationByPersonIdAndPartyApplicationId, ENCRYPTION_KEY_NAME } from '../dal/person-application-repo';
import { allowedToReviewApplication } from '../../../common/acd/access';
import { APPLICATION_EXPIRATION_DAYS, FADV_RESPONSE_STATUS, PARTY_CREDIT_REPORT_EXPIRED_BANNER } from '../../common/screening-constants';
import { getScreeningOnHoldValues } from '../screening/screening-helper';
import { ExpirationScreeningTypes } from '../../../common/enums/fadvRequestTypes';
import config from '../../config';
import { assert } from '../../../common/assert';
import { replaceTemplatedValues } from '../../../common/helpers/utils';
import loggerModule from '../../../common/helpers/logger';
import { now, toMoment, formatMoment } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_FORMAT, UTC_TIMEZONE, EXPORT_FILENAME_TIMESTAMP_FORMAT } from '../../../common/date-constants';
import { REVA_SERVICE_STATUS } from '../../../common/enums/applicationTypes';
import { mapApplicantIdToPersonId } from '../helpers/base-fadv-helper';
import { decrypt } from '../../../common/server/crypto-helper';
import { isExpiredDate } from '../../../common/helpers/date-utils';

const logger = loggerModule.child({ subType: 'screeningService' });

const { minTime: longScreeningRequestMinTime, maxTime: longScreeningRequestMaxTime } = config.fadv.longRunningScreeningRequestsInterval;

const wereDisclosuresSelected = persons => persons.some(person => !isEmpty(person.disclosures));

// returns array with most recent screening results at the head of the array
const sortScreeningsByCreationThenResponseDate = (screeningResults, limit = 0) => {
  const sortedResults = orderBy(screeningResults, ['created_at', 'submissionResponseCreatedAt'], ['desc', 'desc']);
  if (!limit || limit < 1) {
    return sortedResults;
  }

  return sortedResults.reduce((acc, screeningResult) => {
    const quoteScreeningResults = acc.filter(
      x => x.quoteId === screeningResult.quoteId && x.rentData.leaseTermMonths === screeningResult.rentData.leaseTermMonths,
    );
    if (quoteScreeningResults.length < limit) {
      acc.push(screeningResult);
    }
    return acc;
  }, []);
};

// returns array with last responses
const filterMostRecentScreeningsCompleted = screeningResults => uniqBy(screeningResults, item => [item.rentData.leaseTermMonths, item.quoteId].join());

const filterCreatedAtNDaysAgo = (applications = [], numOfDaysAgo = APPLICATION_EXPIRATION_DAYS) =>
  applications.filter(
    application => now({ timezone: application.timezone }).diff(toMoment(application.created_at, { timezone: application.timezone }), 'days') < numOfDaysAgo,
  );

const getScreeningExpirationAndCreationDates = (creationDate, timezone, expirationDays = APPLICATION_EXPIRATION_DAYS) => {
  if (!creationDate) return {};
  const minCreateAt = toMoment(creationDate, { timezone });
  return {
    screeningCreatedAt: minCreateAt.clone(),
    screeningExpirationDate: minCreateAt.add(expirationDays, 'd'),
  };
};

const getExpirationScreeningType = (creationDate, expirationDays = APPLICATION_EXPIRATION_DAYS, daysBeforeExpiration = 3) => {
  const diff = now().diff(toMoment(creationDate), 'days');
  if (diff >= expirationDays) {
    return ExpirationScreeningTypes.EXPIRED;
  }
  if (diff >= expirationDays - daysBeforeExpiration) {
    return ExpirationScreeningTypes.CLOSE_TO_EXPIRE;
  }
  return ExpirationScreeningTypes.NONE;
};

const getScreeningMetadata = async (partyId, screeningResults) => {
  // application without quote wont be sent again to fadv on resume/rerun screening, so will filter them and only used when all of them have no quote, this is only to compute expired results
  const allScreeningResultsDontHaveQuoteId = screeningResults.every(screeningResult => !screeningResult.quoteId);
  const filteredScreeningResults = allScreeningResultsDontHaveQuoteId ? screeningResults : screeningResults.filter(screeningResult => screeningResult.quoteId);
  const sortedResults = sortScreeningsByCreationThenResponseDate(filteredScreeningResults);
  const lastScreeningResults = filterMostRecentScreeningsCompleted(sortedResults);
  const expirationList = lastScreeningResults.map(screeningResult => ({
    expirationScreeningType: getExpirationScreeningType(screeningResult.created_at),
    createdAt: screeningResult.applicationCreatedAt,
    timezone: screeningResult.timezone,
  }));
  let expirationScreeningType;
  let createdAt;
  let timezone;

  const getFirstExpiredScreeningByType = type => expirationList.find(item => item.expirationScreeningType === type);

  const expiredScreening = getFirstExpiredScreeningByType(ExpirationScreeningTypes.EXPIRED);
  const closeToExpireScreening = getFirstExpiredScreeningByType(ExpirationScreeningTypes.CLOSE_TO_EXPIRE);

  if (expiredScreening) {
    expirationScreeningType = ExpirationScreeningTypes.EXPIRED;
    createdAt = expiredScreening.createdAt;
    timezone = expiredScreening.timezone;
  } else if (closeToExpireScreening) {
    expirationScreeningType = ExpirationScreeningTypes.CLOSE_TO_EXPIRE;
    createdAt = closeToExpireScreening.createdAt;
    timezone = closeToExpireScreening.timezone;
  } else {
    expirationScreeningType = ExpirationScreeningTypes.NONE;
  }

  const dates = getScreeningExpirationAndCreationDates(createdAt, timezone);

  return {
    expirationScreeningType,
    ...dates,
  };
};

// returns timestamp of when the application was originally ready for screening
// This is used to display an appropriate message on the client side based on
// how much time has passsed
const getTimeReadyForScreening = (ctx, members, personApplications) => {
  if (!members || !members.length) {
    // this only happens during testing.  In real life, we would not be looking at screening results for parties with no members
    logger.warn({ ctx }, 'No members found during getTimeReadyForScreening');
  }
  const mostRecentlyUpdatedMember = maxBy(members, 'updated_at') || {};
  const lastMemberChangedAt = toMoment(mostRecentlyUpdatedMember.updated_at);
  const mostRecentlyUpdatedApplication = maxBy(personApplications, 'updated_at') || {};
  const lastApplicationChangedAt = toMoment(mostRecentlyUpdatedApplication.updated_at);
  const readyMoment = lastMemberChangedAt.isAfter(lastApplicationChangedAt) ? lastMemberChangedAt : lastApplicationChangedAt;
  logger.trace(
    {
      ctx,
      lastMemberChangedAt,
      lastApplicationChangedAt,
      readyTime: readyMoment,
    },
    'calculated timeReadyForScreening',
  );
  return readyMoment.toJSON();
};

const getApplicantsInfoByPartyId = async (ctx, partyId) => {
  if (!partyId) {
    throw new ServiceError({ token: 'MISSING_PARTY__ID', status: 400 });
  }
  if (!ctx.tenantId) {
    throw new ServiceError({ token: 'MISSING_TENANT_ID', status: 400 });
  }

  const partyMembers = await loadPartyMembers(ctx, partyId);
  assert(partyMembers, 'getApplicantsInfoByPartyId: unable to load partyMembers!');

  const personApplications = await getPersonApplicationsByPartyId(ctx, partyId);
  const personApplicationsAdditionalData = personApplications.map(personApplication => personApplication.additionalData);
  const applicantIdToPersonId = mapApplicantIdToPersonId(personApplications);

  return { partyMembers, personApplications, personApplicationsAdditionalData, applicantIdToPersonId };
};

export const getAllScreeningResultsForParty = async (ctx, partyId, options = { filterExpiredApplications: false, excludeObsolete: true }) => {
  logger.info({ ctx, partyId, options }, 'getAllScreeningResultsForParty');

  const { partyMembers, personApplications, personApplicationsAdditionalData, applicantIdToPersonId } = await getApplicantsInfoByPartyId(ctx, partyId);

  const filterExpiredApplications = !!options.filterExpiredApplications;
  const excludeObsolete = !!options.excludeObsolete;

  let screeningResults = await dal.getAllScreeningResultsForParty(ctx, partyId, { excludeObsolete });
  logger.info({ ctx, partyId, numScreeningResults: screeningResults.length }, 'back from getAllScreeningResultsForParty');

  // TODO: put expired expiration filtering in DB query
  screeningResults = filterExpiredApplications ? filterCreatedAtNDaysAgo(screeningResults) : screeningResults;

  screeningResults = getEnhancedScreenings(
    ctx,
    screeningResults,
    wereDisclosuresSelected(personApplicationsAdditionalData),
    partyMembers,
    applicantIdToPersonId,
    partyId,
  );
  const areScreeningsCompleted = areAllScreeningsCompleted(screeningResults);
  screeningResults = sortScreeningsByCreationThenResponseDate(screeningResults);

  // MAM: don't filter down results ;  this is currently only used in testing...
  if (excludeObsolete) screeningResults = filterMostRecentScreeningsCompleted(screeningResults);

  logger.trace({ ctx, partyId, options }, 'about to getAllScreeningRequestsForParty');
  let screeningRequests = await dal.getAllScreeningRequestsForParty(ctx, partyId, { excludeObsolete });
  logger.info({ ctx, partyId, numScreeningRequests: screeningRequests.length }, 'back from getAllScreeningRequestsForParty');
  screeningRequests = filterExpiredApplications ? filterCreatedAtNDaysAgo(screeningRequests) : screeningRequests;
  screeningResults = enhanceScreeningWithHasNoPendingResponsesFlag({ screeningResults });
  return {
    screeningResults,
    areScreeningsCompleted,
    screeningRequests,
    timeReadyForScreening: getTimeReadyForScreening(ctx, partyMembers, personApplications),
  };
};

const getMostRecentObsoleteScreeningResults = screeningResults =>
  screeningResults.reduce((acc, sr) => {
    if (!sr.isObsolete) return acc;

    const matchingResultIndex = acc.findIndex(x => x.rentData.leaseTermMonths === sr.rentData.leaseTermMonths && x.quoteId === sr.quoteId);
    if (matchingResultIndex >= 0) {
      const matchingResult = acc[matchingResultIndex];
      acc[matchingResultIndex] = maxBy([sr, matchingResult], ['created_at', 'submissionResponseCreatedAt']);
    } else {
      acc.push(sr);
    }
    return acc;
  }, []);

export const getScreeningResultsForParty = async (ctx, partyId) => {
  logger.info({ ctx, partyId }, 'getScreeningResultsForParty');

  const { partyMembers, personApplications, personApplicationsAdditionalData, applicantIdToPersonId } = await getApplicantsInfoByPartyId(ctx, partyId);

  let screeningResults = await dal.getAllScreeningResultsForParty(ctx, partyId, { excludeObsolete: false });
  logger.info({ ctx, partyId, numScreeningResults: screeningResults.length }, 'getScreeningResultsForParty - back from getAllScreeningResultsForParty');

  screeningResults = getEnhancedScreenings(
    ctx,
    screeningResults,
    wereDisclosuresSelected(personApplicationsAdditionalData),
    partyMembers,
    applicantIdToPersonId,
    partyId,
  );

  const obsoleteScreeningResults = getMostRecentObsoleteScreeningResults(screeningResults);

  const areScreeningsCompleted = areAllScreeningsCompleted(screeningResults);
  screeningResults = sortScreeningsByCreationThenResponseDate(screeningResults, 2);

  const screeningRequests = await dal.getAllScreeningRequestsForParty(ctx, partyId, { excludeObsolete: true });
  logger.info({ ctx, partyId, numScreeningRequests: screeningRequests.length }, 'getScreeningResultsForParty -back from getAllScreeningRequestsForParty');
  screeningResults = enhanceScreeningWithHasNoPendingResponsesFlag({ screeningResults });

  return {
    screeningResults,
    obsoleteScreeningResults,
    areScreeningsCompleted,
    screeningRequests,
    timeReadyForScreening: getTimeReadyForScreening(ctx, partyMembers, personApplications),
  };
};

// Returns screening summary for the quote to be promoted (if quoteId and leaseTermId are provided), or the currently promoted quote otherwise
export const getScreeningSummary = async (ctx, { partyId, quoteId, leaseTermId }) => {
  logger.info({ ctx, partyId, quoteId, leaseTermId }, 'getScreeningSummary');
  const { tenantId } = ctx;
  badRequestErrorIfNotAvailable([
    { property: tenantId, message: 'MISSING_TENANT_ID' },
    { property: partyId, message: 'MISSING_PARTY_ID' },
  ]);

  const partyMembers = await loadPartyMembers(ctx, partyId);
  assert(partyMembers, 'getScreeningSummary: unable to load partyMembers');
  const personApplications = await getPersonApplicationsByPartyId(ctx, partyId);
  const applicantIdToPersonId = mapApplicantIdToPersonId(personApplications);
  const applicantIds = personApplications.map(personApplication => personApplication.applicantId);
  const personIds = personApplications.map(personApplication => personApplication.personId);
  const screeningRequestsForParty = await dal.getAllScreeningRequestsForParty(ctx, partyId);
  const screeningResults = await dal.getAllScreeningResultsForParty(ctx, partyId);
  const mostRecentScreeningResult = await getMostRecentScreeningResult(ctx, {
    partyId,
    screeningResults,
    applicantIds,
    personIds,
    leaseTermId,
    quoteId,
    createdAtOrderBy: 'submissionResponseCreatedAt',
  });

  const mostRecentScreeningRequest = await getMostRecentScreeningResult(ctx, {
    partyId,
    screeningResults: screeningRequestsForParty,
    applicantIds,
    personIds,
    leaseTermId,
    quoteId,
  });
  const lastRequestHasResponse =
    mostRecentScreeningResult && mostRecentScreeningRequest && mostRecentScreeningResult.submissionRequestId === mostRecentScreeningRequest.id;

  let screeningComputed = lastRequestHasResponse ? mostRecentScreeningResult : mostRecentScreeningRequest;

  screeningComputed = replacePersonIdOnApplicantsIfNeeded(screeningComputed, personApplications);

  // adding tenantId in case there is no response for screening yet
  const { residents, guarantors, occupants } = await parseScreeningApplicants(ctx, partyId, screeningComputed);
  const [enhancedScreeningResult] = screeningComputed.id
    ? getEnhancedScreenings(ctx, [screeningComputed], wereDisclosuresSelected(residents.concat(occupants)), partyMembers, applicantIdToPersonId, partyId)
    : [{}];

  // TODO: convert these two functions to use decision service
  const recommendation = enhancedScreeningResult.applicationDecision;

  const {
    recommendedConditions,
    screeningCriterias,
    screeningCriteriaResults,
    isBackgroundReportEmpty,
    allApplicantsHaveMatchInCriteriaResult,
    hasCreditThinFile,
  } = enhancedScreeningResult;

  const { expirationScreeningType, screeningExpirationDate, screeningCreatedAt } = await getScreeningMetadata(partyId, screeningResults);

  const { isHeld: isPartyApplicationOnHold, holdReasons } = await getScreeningOnHoldValues(ctx, partyId);

  return {
    recommendation,
    recommendedConditions,
    residents,
    guarantors,
    occupants,
    screeningCriterias,
    screeningCriteriaResults,
    allApplicantsHaveMatchInCriteriaResult,
    warnings: await getScreeningSummaryWarnings(ctx, {
      partyId,
      mostRecentScreeningResult,
      screeningResults,
      screeningRequests: screeningRequestsForParty,
      quoteId,
      leaseTermId,
    }),
    isBackgroundReportEmpty,
    isPartyApplicationOnHold,
    holdReasons,
    hasApplicationScreeningStarted: !!screeningRequestsForParty.length,
    expirationScreeningType,
    screeningExpirationDate,
    screeningCreatedAt,
    screeningResult: mostRecentScreeningResult,
    hasCreditThinFile,
  };
};

export const canUserViewFullReportSummary = async (ctx, partyId, authUser) => {
  const party = await loadPartyById(ctx, partyId);
  return allowedToReviewApplication(authUser, party);
};

const getHTMLPageWithMsg = (message = '') => `<HTML><HEAD><STYLE></STYLE></HEAD><BODY>${message}</BODY></HTML>`;

const addExpiredDateBannerToHtml = (report, date, options) => {
  const { backgroundReport = '' } = report;
  const { timezone = UTC_TIMEZONE } = options;
  const BODY_TAG = '<BODY>';
  const expiredDate = formatMoment(date, {
    format: MONTH_DATE_YEAR_FORMAT,
    timezone,
  });
  const indexOfBody = backgroundReport.indexOf(BODY_TAG) + BODY_TAG.length;
  const replacedExpiredBanner = replaceTemplatedValues(PARTY_CREDIT_REPORT_EXPIRED_BANNER, {
    expiredDate,
  });
  const formatedReport = {
    ...report,
    backgroundReport: `${backgroundReport.slice(0, indexOfBody)} ${replacedExpiredBanner} ${backgroundReport.slice(indexOfBody)}`,
  };

  return formatedReport;
};

const getSingleScreeningReport = async (ctx, partyId, screeningReq, options) => {
  const { submissionRequestId, propertyId, quoteId } = screeningReq || {};
  if (!submissionRequestId || !propertyId) return '';
  const { additionalInfoRequired = false } = options || {};
  const timezone = await getPropertyTimezone(ctx, propertyId);
  logger.debug({ ctx, partyId, submissionRequestId }, 'get screening full report');
  const onlyIfComplete = false;
  const report = await dal.getSubmissionResponseBySubmissionRequestId(ctx, submissionRequestId, onlyIfComplete);
  if (!report || !report?.backgroundReport) return null;
  const createdAt = toMoment(report.created_at, { timezone }).format(EXPORT_FILENAME_TIMESTAMP_FORMAT);
  const screeningCreationDate = await dal.getScreeningCreationDate(ctx, partyId);
  const isExpired = isExpiredDate(screeningCreationDate.created_at, timezone, APPLICATION_EXPIRATION_DAYS);
  report.quoteId = quoteId;

  if (additionalInfoRequired) {
    report.createdAt = createdAt;
  }

  if (report.backgroundReport && isExpired) {
    return addExpiredDateBannerToHtml(report, screeningCreationDate.created_at, { additionalInfoRequired, timezone });
  }

  if (report && report.status !== FADV_RESPONSE_STATUS.COMPLETE) {
    const htmlPageWithMsg = getHTMLPageWithMsg(t('LEASE_WITHOUT_COMPLETED_SCREENING'));
    return {
      ...report,
      backgroundReport: htmlPageWithMsg,
    };
  }
  return report;
};

export const getScreeningReportSummary = async (ctx, { partyId, quoteId, leaseTermId, excludeObsolete, allowUnmatched = false, returnAll = false }) => {
  logger.info({ ctx, partyId }, 'getScreeningReportSummary');

  const screeningResults = await dal.getAllScreeningResultsForParty(ctx, partyId, { excludeObsolete });
  if (!screeningResults || !screeningResults.length) return '';

  const personApplications = await getPersonApplicationsByPartyId(ctx, partyId);
  const applicantIds = personApplications.map(personApplication => personApplication.applicantId);
  const personIds = personApplications.map(personApplication => personApplication.personId);

  const res = await getMostRecentScreeningResult(ctx, {
    partyId,
    screeningResults,
    applicantIds,
    personIds,
    leaseTermId,
    quoteId,
    createdAtOrderBy: 'submissionResponseCreatedAt',
    allowUnmatched,
    returnAll,
  });

  if (returnAll) {
    if (!res?.length) return '';
    return await mapSeries(res, async screening => await getSingleScreeningReport(ctx, partyId, screening, { additionalInfoRequired: true }));
  }
  return await getSingleScreeningReport(ctx, partyId, res, { additionalInfoRequired: true });
};

export const existsSubmissionResponse = async (ctx, submissionRequestId) => await dal.existsSubmissionResponse(ctx, submissionRequestId);

const getApplicantsWithFilteredStatus = (
  serviceStatus = {},
  serviceFilter = ({ status }) => ![REVA_SERVICE_STATUS.COMPLETE, REVA_SERVICE_STATUS.BLOCKED].includes(status),
) =>
  Object.keys(serviceStatus).reduce((acc, applicantId) => {
    const serviceStatusForApplicant = serviceStatus[applicantId] || [];
    const filteredServices = serviceStatusForApplicant.filter(serviceFilter).map(service => service);

    if (filteredServices.length) {
      acc.push({ applicantId, services: filteredServices });
    }

    return acc;
  }, []);

export const getApplicantIdsWithIncompleteScreening = async (ctx, submissionRequestId) => {
  const serviceStatus = await dal.getLatestServiceStatusBySubmissionRequestId(ctx, submissionRequestId);

  return {
    applicantsWithIncompleteScreening: getApplicantsWithFilteredStatus(serviceStatus),
    applicantsWithBlockedServiceStatus: getApplicantsWithFilteredStatus(serviceStatus, ({ status }) => status === REVA_SERVICE_STATUS.BLOCKED),
  };
};

export const getOrphanedScreeningRequests = async (ctx, time) => await dal.getOrphanedScreeningRequests(ctx, time);

export const getFirstScreeningForParty = async (ctx, partyId) => await dal.getFirstScreeningForParty(ctx, partyId);

export const getLatestUnalertedScreeningRequests = async ctx => {
  const time = { minTime: longScreeningRequestMinTime, maxTime: longScreeningRequestMaxTime, timeFrame: 'minutes' };
  return await dal.getOrphanedScreeningRequests(ctx, time, true);
};

export const updateScreeningRequest = async (ctx, id, submissionRequest) => await dal.updateSubmissionRequest(ctx, id, submissionRequest);

export const markAllScreeningRequestsForPartyAsObsolete = async (ctx, partyId) => {
  logger.info({ ctx, partyId }, 'markAllScreeningRequestsForPartyAsObsolete (service)');
  await dal.markAllScreeningRequestsForPartyAsObsolete(ctx, partyId);
};

export const getScreeningCreationDate = async (ctx, partyId) => await dal.getScreeningCreationDate(ctx, partyId);

export const getPendingRequests = async (ctx, partyId) => await dal.getPendingRequests(ctx, partyId);

export const updateSubmissionRequest = async (ctx, id, submissionRequest) => await dal.updateSubmissionRequest(ctx, id, submissionRequest);

const filterStuckSubmissionRequests = async (ctx, stuckSubmissionRequests = []) =>
  await stuckSubmissionRequests.reduce(async (accum, request) => {
    const resolvedAccum = await accum;
    const { id: submissionRequestId, applicationDecision, partyApplicationId, quoteId, rentData } = request;
    const requestWithError = applicationDecisionHasErrorOther(applicationDecision);
    let prevRequestHasErrorOther = false;
    let include = true;

    if (requestWithError) {
      const prevSubmissionRequest = await dal.getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm(ctx, partyApplicationId, quoteId, rentData.leaseTermMonths);
      if (prevSubmissionRequest) {
        const { id: prevSubmissionRequestId, applicationDecision: prevApplicationDecision } = prevSubmissionRequest;
        prevRequestHasErrorOther = applicationDecisionHasErrorOther(prevApplicationDecision);

        prevRequestHasErrorOther &&
          logger.trace(
            { ctx, submissionRequestId, applicationDecision, quoteId, prevSubmissionRequestId, prevApplicationDecision },
            'Skipping stuck request because of previous request error',
          );

        include = !prevRequestHasErrorOther;
      }
    }

    include && resolvedAccum.push(request);

    return resolvedAccum;
  }, Promise.resolve([]));

/*
  A stuck submission request is one that meets the following criteria:
  - the request is incomplete (we have a response)
  - there is no application decision and all services statuses are complete or
  - application decision has error_other and raw response contains this message: unable to parse applicant section
  - the incomplete response is at least 2 minutes old
*/
export const getStuckSubmissionRequests = async (ctx, options = { responseInterval: true, checkPrevRequest: true }) => {
  const { checkPrevRequest } = options;
  let stuckSubmissionRequests = await dal.getStuckSubmissionRequests(ctx, options);

  if (checkPrevRequest) {
    stuckSubmissionRequests = await filterStuckSubmissionRequests(ctx, stuckSubmissionRequests);
  }

  return stuckSubmissionRequests;
};

export const getPrevSubmissionRequestData = async (ctx, partyApplicationId, rentData = {}) => {
  const { quoteId, leaseTermMonths } = rentData;
  const hasPublishedQuote = !!(quoteId && leaseTermMonths);

  if (hasPublishedQuote) {
    return await dal.getPrevSubmissionRequestDataByQuoteIdAndLeaseTerm(ctx, partyApplicationId, quoteId, leaseTermMonths);
  }

  return await dal.getPrevSubmissionRequestData(ctx, partyApplicationId);
};

const prepareApplicantDataForFadv = async (ctx, submissionRequest) => {
  const { applicantData, partyApplicationId, id: submissionRequestId } = submissionRequest;
  if (!applicantData) return submissionRequest;

  /*
    When merging parties we could end up with a person application no longer beloning
    to a party application. This is no longer expected to occur since closed parties
    due to party merge will have all its screening requests marked as obsolete.
  */
  const errorMsg = 'Person application not found in party application';

  const applicants = await mapSeries(applicantData.applicants, async applicant => {
    const { personId } = applicant;
    const personApplication = await getPersonApplicationByPersonIdAndPartyApplicationId(ctx, personId, partyApplicationId);
    if (!personApplication) {
      logger.error({ ctx, submissionRequestId, personId, partyApplicationId }, errorMsg);
      throw new NoRetryError(errorMsg);
    }

    const { ssn, itin, sendSsnEnabled } = personApplication;
    return {
      ...omit(applicant, ['ssn', 'itin', 'socSecNumber']),
      ...((ssn || itin) && sendSsnEnabled ? { socSecNumber: decrypt(ssn || itin, ENCRYPTION_KEY_NAME) } : {}),
    };
  });

  const applicantDataWithSsn = { ...applicantData, applicants };

  return { ...submissionRequest, applicantData: applicantDataWithSsn };
};

export const getScreeningRequest = async (ctx, id, decryptSsn = false) => {
  const submissionRequest = await dal.getSubmissionRequest(ctx, id);

  if (!decryptSsn || !submissionRequest) return submissionRequest;

  return await prepareApplicantDataForFadv(ctx, submissionRequest);
};

export const getOrphanedApplicantReports = async ctx => {
  const { minTime, maxTime } = config.fadv.pollScreeningUnreceivedResponsesInterval;
  return await applicantReportDal.getOrphanedApplicantReports(ctx, { minTime, maxTime });
};

export const getStuckApplicantReports = async ctx => {
  const { minTime, maxTime } = config.fadv.pollScreeningUnreceivedResponsesInterval;
  return await applicantReportDal.getStuckApplicantReports(ctx, { minTime, maxTime });
};
