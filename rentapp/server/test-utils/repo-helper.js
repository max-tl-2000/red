/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// createOrUpdatePersonApplication needs to go through service so that partyApplication is created too
import get from 'lodash/get';
import getUUID from 'uuid/v4';
import { mapSeries } from 'bluebird';
import config from '../../config';
import { createOrUpdatePersonApplication } from '../services/person-application';

import { createPartyApplication, getPartyApplicationByPartyId } from '../dal/party-application-repo';
import { createSubmissionRequest, createSubmissionResponse, updateSubmissionRequest, updateSubmissionResponse } from '../dal/fadv-submission-repo';
import { createApplicationInvoice } from '../dal/application-invoices-repo';
import { createPartyMember } from '../../../server/dal/partyRepo';
import { tenant } from '../../../server/testUtils/setupTestGlobalContext';
import { now } from '../../../common/helpers/moment-utils';
import { createApplicantData as createApplicantDataDal } from '../dal/applicant-data-repo';
import {
  createABuilding,
  createAnInventory,
  createAPartyMember as createAScreeningPartyMember,
  createAPerson,
  createAProperty,
} from '../../../server/testUtils/repoHelper';
import { ApplicantReportNames, ApplicantReportStatus } from '../../../common/enums/screeningReportTypes';
import { createApplicantReport, updateApplicantReport } from '../dal/applicant-report-repo';
import creditReport from '../services/__integration__/fixtures/basic-credit-applicant-report.json';
import criminalReport from '../services/__integration__/fixtures/basic-criminal-applicant-report.json';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getQuoteWithPropertyDataByPartyId } from '../../../server/dal/quoteRepo';
import { createApplicantReportRequestTracking } from '../dal/applicant-report-request-tracking-repo';
import { FADV_TO_DATABASE_SERVICE_STATUS_TRANS, FADV_SERVICE_STATUS } from '../../common/enums/fadv-service-status';
import { createApplicantReportResponseTracking, updateApplicantReportResponseTracking } from '../dal/applicant-report-response-tracking-repo';
import { FADV_RESPONSE_STATUS } from '../../common/screening-constants';
import { FadvRequestTypes } from '../../../common/enums/fadvRequestTypes';
import { ServiceNames } from '../../../common/enums/applicationTypes';
const { MemberType, PartyStateType } = DALTypes;
const { minOrphanedScreeningResponseAge } = config.fadv;
export const ctx = { tenantId: tenant.id };

export const createAPersonApplication = async (
  applicationData = {},
  personId,
  partyId,
  partyApplicationId,
  paymentCompleted = false,
  tenantId,
  sendSsnEnabled = false,
  maskSSN = true,
) =>
  await createOrUpdatePersonApplication(
    { tenantId: tenantId || tenant.id },
    {
      applicationData,
      additionalData: applicationData.additionalData,
      personId,
      partyId,
      partyApplicationId,
      paymentCompleted,
      sendSsnEnabled,
      maskSSN,
    },
    true, // QUESTION for Edgar - this was false -- why?
  );

export const createAPartyApplication = async (partyId, partyApplicationId, applicationData = {}, tenantId) =>
  await createPartyApplication(
    { tenantId: tenantId || tenant.id },
    {
      partyId,
      id: partyApplicationId,
      ...applicationData,
    },
  );

export const createAPartyMember = async ({ personId, fullName, memberType, memberState }, partyId, tenantId) =>
  await createPartyMember({ tenantId: tenantId || tenant.id }, { personId, fullName, memberType, memberState }, partyId);

export const createASubmissionRequest = async submissionRequest => await createSubmissionRequest(tenant, submissionRequest);

export const createASubmissionResponse = async submissionResponse => await createSubmissionResponse(tenant, submissionResponse);

export const createAnApplicationInvoice = async invoice => await createApplicationInvoice(tenant.id, invoice);

export const updateApplicationCreationDate = async ({ submissionRequestId, submissionResponseId, creationDate }) => {
  await updateSubmissionRequest(ctx, submissionRequestId, { created_at: creationDate });
  await updateSubmissionResponse(ctx, submissionResponseId, { created_at: creationDate });
};

export const getAPartyApplicationByPartyId = async partyId => await getPartyApplicationByPartyId(ctx, partyId);

export const createApplicantData = async ({
  personId,
  propertyId,
  endDate,
  applicationDataDiff,
  timestamp = now(),
  applicationData = { email: 'email@reva.tech', phone: '15555555555', lastName: 'Doe', firstName: 'John', grossIncomeMonthly: 5000 },
  applicationDataTimestamps = { email: timestamp, phone: timestamp, lastName: timestamp, firstName: timestamp, grossIncomeMonthly: timestamp },
}) => {
  applicationDataDiff = (!applicationDataDiff && applicationData) || applicationDataDiff;

  const applicantData = {
    personId,
    propertyId,
    applicationData,
    applicationDataTimestamps,
    applicationDataDiff,
    startDate: timestamp,
    endDate,
  };

  return await createApplicantDataDal(tenant, applicantData);
};

export const getQuotePropertyId = async (quoteId, partyAssignedPropertyId) =>
  (quoteId && ((await getQuoteWithPropertyDataByPartyId(ctx, quoteId)) || {}).propertyId) || partyAssignedPropertyId;

export const createUnitInventory = async propertyId => {
  const { id: buildingId } = await createABuilding({ propertyId });
  return await createAnInventory({ propertyId, buildingId });
};

const hasNoResponseApplicantReportStatus = status =>
  [ApplicantReportStatus.COMPILING, ApplicantReportStatus.PENDING, ApplicantReportStatus.CANCELED].includes(status);

const createReportData = async ({ personId, reportName, applicantDataId, reportStatus, reportData, serviceStatus }) =>
  await createApplicantReport(ctx, {
    personId,
    reportName,
    applicantDataId,
    status: reportStatus,
    serviceStatus,
    reportData,
    validUntil: hasNoResponseApplicantReportStatus(reportStatus) ? null : now().add(30, 'days').toDate(),
  });

const getRequiredApplicantReports = (assignedPropertyApplicationSettings, { leaseType, memberType }, quotes = []) => {
  if (!quotes.length) return assignedPropertyApplicationSettings;

  const result = quotes.reduce((acc, quote) => {
    const partyMemberTypeAppSettings = get(quote, `settings.applicationSettings.${leaseType}.${memberType.toLowerCase()}`);

    partyMemberTypeAppSettings.creditReportRequiredFlag = partyMemberTypeAppSettings.creditReportRequiredFlag || false;
    partyMemberTypeAppSettings.criminalReportRequiredFlag = partyMemberTypeAppSettings.criminalReportRequiredFlag || false;

    return {
      creditReportRequiredFlag: acc.creditReportRequiredFlag || partyMemberTypeAppSettings.creditReportRequiredFlag,
      criminalReportRequiredFlag: acc.criminalReportRequiredFlag || partyMemberTypeAppSettings.criminalReportRequiredFlag,
    };
  }, assignedPropertyApplicationSettings);

  return {
    creditReportRequiredFlag: result.creditReportRequiredFlag || false,
    criminalReportRequiredFlag: result.criminalReportRequiredFlag || false,
  };
};

const getAssignedPropertyApplicationSettings = (propertyApplicationSettings, { leaseType, memberType }) => {
  const partyTypeApplicationSettings = get(propertyApplicationSettings, leaseType);
  const partyMemberTypeReportSettings = get(partyTypeApplicationSettings, memberType.toLowerCase());

  return {
    creditReportRequiredFlag: partyMemberTypeReportSettings.creditReportRequiredFlag || false,
    criminalReportRequiredFlag: partyMemberTypeReportSettings.criminalReportRequiredFlag || false,
  };
};

const completeServiceStatus = {
  Eviction: { status: FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.COMPLETED], updateAt: new Date() },
  Collections: { status: FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.COMPLETED], updateAt: new Date() },
  SSN: { status: FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.COMPLETED], updateAt: new Date() },
};

const incompleteServiceStatus = {
  ...completeServiceStatus,
  Eviction: { status: FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.INCOMPLETE], updateAt: new Date() },
  SSN: { status: FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.IN_PROCESS], updateAt: new Date() },
};

const blockedCreditServiceStatus = {
  ...completeServiceStatus,
  Credit: { status: FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.BLOCKED], updateAt: new Date() },
};

const blockedCriminalServiceStatus = {
  ...completeServiceStatus,
  Criminal: { status: FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.BLOCKED], updateAt: new Date() },
};

const createApplicantReports = async (
  { partyMember, party },
  { hasApplicantData, propertyApplicationSettings, quotes, activePartyMemberAppDataId: applicantDataId, blockedServiceStatus },
  reportStatus,
) => {
  if (!hasApplicantData) return {};

  const { personId, memberType } = partyMember;
  const { leaseType } = party;
  const leaseAndMemberType = {
    leaseType,
    memberType,
  };

  let serviceStatus = reportStatus === ApplicantReportStatus.COMPILING ? incompleteServiceStatus : null;
  if (blockedServiceStatus) {
    const { service } = blockedServiceStatus;
    serviceStatus = service === ServiceNames.CREDIT ? blockedCreditServiceStatus : blockedCriminalServiceStatus;
  }

  const { creditReportRequiredFlag, criminalReportRequiredFlag } = getRequiredApplicantReports(
    getAssignedPropertyApplicationSettings(propertyApplicationSettings, leaseAndMemberType),
    leaseAndMemberType,
    quotes,
  );

  return {
    createdCriminalReport: criminalReportRequiredFlag
      ? await createReportData({
          personId,
          reportName: ApplicantReportNames.CRIMINAL,
          applicantDataId,
          reportStatus,
          reportData: criminalReport,
          serviceStatus,
        })
      : null,
    createdCreditReport: creditReportRequiredFlag
      ? await createReportData({ personId, reportName: ApplicantReportNames.CREDIT, applicantDataId, reportStatus, reportData: creditReport, serviceStatus })
      : null,
  };
};

const createApplicantDataHistory = async ({ personId, propertyId }) => {
  await createApplicantData({ personId, propertyId, endDate: new Date() });
  return await createApplicantData({ personId, propertyId });
};

const createApplicantReportRequest = async (personId, propertyId, applicantReportId, reportName) =>
  await createApplicantReportRequestTracking(ctx, {
    personId,
    propertyId,
    applicantReportId,
    isObsolete: false,
    requestApplicantId: getUUID(),
    requestType: FadvRequestTypes.NEW,
    reportName,
  });

const createApplicantReportRequestAndResponse = async (propertyId, applicantReportName, applicantReport, { service, serviceBlockedStatus }) => {
  if (applicantReport) {
    const { personId, id: applicantReportId } = applicantReport;
    const { id: screeningRequestId } = await createApplicantReportRequest(personId, propertyId, applicantReportId, applicantReportName);

    const { id: previousResponseId } = await createApplicantReportResponseTracking(ctx, {
      screeningRequestId,
      status: FADV_RESPONSE_STATUS.INCOMPLETE,
      serviceStatus: serviceBlockedStatus && service === ServiceNames.CREDIT ? blockedCreditServiceStatus : incompleteServiceStatus,
    });

    await createApplicantReportResponseTracking(ctx, {
      screeningRequestId,
      status: FADV_RESPONSE_STATUS.INCOMPLETE,
      serviceStatus: serviceBlockedStatus && service === ServiceNames.CREDIT ? blockedCreditServiceStatus : incompleteServiceStatus,
      serviceBlockedStatus,
    });

    await updateApplicantReportResponseTracking(ctx, previousResponseId, { created_at: now().add(-120, 'seconds') });
  }
};

const createApplicantReportsRequestResponseHistory = async (propertyId, { createdCreditReport, createdCriminalReport }, blockedServiceStatus = {}) => {
  const { service, serviceBlockedStatus } = blockedServiceStatus;

  await createApplicantReportRequestAndResponse(propertyId, ApplicantReportNames.CREDIT, createdCreditReport, {
    service: service || ServiceNames.CREDIT,
    serviceBlockedStatus,
  });

  await createApplicantReportRequestAndResponse(propertyId, ApplicantReportNames.CRIMINAL, createdCriminalReport, {
    service: service || ServiceNames.CRIMINAL,
    serviceBlockedStatus,
  });
};

const createApplicantReportHistory = async ({ partyMemberData, applicantReportData, activeReportStatus, blockedServiceStatus }) => {
  if (!applicantReportData.hasApplicantData) return;

  const { partyMember, party } = partyMemberData;
  const { personId } = partyMember;
  const { assignedPropertyId: propertyId } = party;
  const { id: activePartyMemberAppDataId } = await createApplicantDataHistory({ personId, propertyId });

  const applicantReportHistoryStatuses = [
    ApplicantReportStatus.CANCELED,
    ApplicantReportStatus.PENDING,
    ApplicantReportStatus.BLOCKED_ADDRESS,
    activeReportStatus,
  ];
  const createdAtTimesForReportHistory = [now(), now().subtract(15, 'seconds'), now().subtract(45, 'seconds'), now().subtract(30, 'seconds')];

  const applicantReports = await mapSeries(
    applicantReportHistoryStatuses,
    async reportHistoryStatus =>
      await createApplicantReports(partyMemberData, { ...applicantReportData, activePartyMemberAppDataId, blockedServiceStatus }, reportHistoryStatus),
  );

  await mapSeries(applicantReports, async (applicantReport, index) => {
    const { createdCreditReport, createdCriminalReport } = applicantReport;
    if (createdCreditReport) await updateApplicantReport(ctx, createdCreditReport.id, { created_at: createdAtTimesForReportHistory[index] });
    if (createdCriminalReport) await updateApplicantReport(ctx, createdCriminalReport.id, { created_at: createdAtTimesForReportHistory[index] });
  });

  if (activeReportStatus === ApplicantReportStatus.COMPILING) {
    const activeApplicantReports = applicantReports.slice(-1).pop();
    await createApplicantReportsRequestResponseHistory(propertyId, activeApplicantReports, blockedServiceStatus);
  }
};

export const createScreeningPartyMember = async ({ party, member, quotes, blockedServiceStatus }) => {
  const { id: partyId } = party;
  const { memberName, memberType, guarantorAssigned, hasApplicantData, assignedProperty, activeReportStatus } = member;
  const propertyApplicationSettings = get(assignedProperty, 'settings.applicationSettings');

  let guarantor;

  if (guarantorAssigned) {
    guarantor = await createAScreeningPartyMember(partyId, {
      memberType: MemberType.GUARANTOR,
      memberState: PartyStateType.APPLICANT,
      fullName: `${memberName} - ${MemberType.GUARANTOR}`,
    });

    await createApplicantReportHistory({
      partyMemberData: { partyMember: guarantor, party },
      applicantReportData: { hasApplicantData, propertyApplicationSettings, quotes },
      activeReportStatus: activeReportStatus || ApplicantReportStatus.COMPLETED,
      blockedServiceStatus,
    });
  }

  const partyMember = await createAScreeningPartyMember(partyId, {
    memberType,
    memberState: PartyStateType.APPLICANT,
    fullName: memberName,
    guaranteedBy: guarantor ? guarantor.id : null,
  });

  await createApplicantReportHistory({
    partyMemberData: { partyMember, party },
    applicantReportData: { hasApplicantData, propertyApplicationSettings, quotes },
    activeReportStatus: activeReportStatus || ApplicantReportStatus.COMPLETED,
    blockedServiceStatus,
  });

  return partyMember;
};

const getRandomNonCompilingApplicantReport = () => {
  const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const nonCompilingApplicantReportStatuses = Object.keys(ApplicantReportStatus).filter(status => status !== 'COMPILING');
  const randomApplicantReportStatus = nonCompilingApplicantReportStatuses[getRandomInt(0, nonCompilingApplicantReportStatuses.length - 1)];
  return ApplicantReportStatus[randomApplicantReportStatus];
};

export const createApplicantReportData = async orphanedReport => {
  const { id: personId } = await createAPerson();
  const { id: propertyId } = await createAProperty();
  const { id: applicantDataId } = await createApplicantData({ personId, propertyId });

  const { id: creditApplicantReportId } = await createApplicantReport(ctx, {
    personId,
    reportData: {},
    applicantDataId,
    reportName: ApplicantReportNames.CREDIT,
    status: orphanedReport ? ApplicantReportStatus.COMPILING : getRandomNonCompilingApplicantReport(),
  });

  const { id: criminalApplicantReportId } = await createApplicantReport(ctx, {
    personId,
    reportData: {},
    applicantDataId,
    reportName: ApplicantReportNames.CRIMINAL,
    status: orphanedReport ? ApplicantReportStatus.COMPILING : getRandomNonCompilingApplicantReport(),
  });

  return await Promise.all([
    createApplicantReportRequest(personId, propertyId, creditApplicantReportId, ApplicantReportNames.CREDIT),
    createApplicantReportRequest(personId, propertyId, criminalApplicantReportId, ApplicantReportNames.CRIMINAL),
  ]);
};

export const createApplicantReportResponse = async (screeningRequestId, responseStatus, options) => {
  const { isResponseInOrphanedTimeFrame, serviceStatusesComplete } = options;
  const _now = now();
  const { id: responseId } = await createApplicantReportResponseTracking(ctx, {
    screeningRequestId,
    status: responseStatus,
    serviceStatus: serviceStatusesComplete ? completeServiceStatus : incompleteServiceStatus,
  });

  const orphanedResponseAge = minOrphanedScreeningResponseAge * 60 + 10;
  const responseCreatedAtDate = isResponseInOrphanedTimeFrame ? now().add(-orphanedResponseAge, 'seconds') : _now;

  if (responseStatus === FADV_RESPONSE_STATUS.INCOMPLETE) {
    const { id: previousResponseId } = await createApplicantReportResponseTracking(ctx, {
      screeningRequestId,
      status: responseStatus,
      serviceStatus: incompleteServiceStatus,
    });

    const previousResponseCreatedAtDate = responseCreatedAtDate.clone().add(-120, 'seconds');

    await updateApplicantReportResponseTracking(ctx, previousResponseId, { created_at: previousResponseCreatedAtDate.toDate() });
  }

  return await updateApplicantReportResponseTracking(ctx, responseId, { created_at: responseCreatedAtDate.toDate() });
};
