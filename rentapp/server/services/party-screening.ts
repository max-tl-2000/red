/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import get from 'lodash/get';
import { IApplicationData } from '../helpers/applicant-types';
import {
  IPartyApplicationScreeningData,
  IApplicantScreeningData,
  ReportStatus,
  MemberType,
  IApplicationScreeningCriteria,
  IApplicationQuote,
  IPartyApplicantData,
  PartyApplicantReport,
  IPropertyApplicationSettings,
  IPartyScreeningCriteria,
  GuarantorResidentRelationship,
  IApplicationSettingsFilter,
  ICreditServiceErrors,
  ICriminalServiceErrors,
} from '../helpers/party-application-screening-decision-types';
import { IDbContext, IDictionaryHash } from '../../../common/types/base-types';
import { ApplicantReportNames } from '../../../common/enums/screeningReportTypes';
import { getPublishedQuotesWithPropertyDataByPartyId, getPropertyApplicationSettingsFromPublishedQuotesByPartyId } from '../../../server/dal/quoteRepo';
import { getPublishedQuoteDataWithMonthlyTotalCharges } from '../../../server/services/quotes';
import { getPartyApplicantData } from '../dal/applicant-data-repo';
import {
  noCreditReportData,
  noCriminalReportData,
  defaultCriminalReportServiceErrors,
  defaultCreditReportServiceErrors,
  defaultNoCreditReportServiceErrors,
  defaultNoCriminalReportServiceErrors,
  BlockedServiceStatusErrorMapper,
  BlockedServiceStatusMessageMapper,
  BlockedServiceUnknownErrorMapper,
} from './helpers/party-application-helper';
import { getPartyAssignedPropertyApplicationSettingsByPartyId } from '../../../server/dal/partyRepo';
import loggerModule from '../../../common/helpers/logger';
import { ICreditReport, ICriminalReport } from '../workers/screening/v2/helpers/report-data-builder';
import { getScreeningCriteriaByPropertyIds } from '../../../server/dal/screeningCriteriaRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ServiceNames } from '../../../common/enums/applicationTypes';
import { isStatusBlocked } from '../workers/screening/v2/helpers/screening-report-response-helper';

const logger = loggerModule.child({ subType: 'partyScreening' });
const { PartyTypes } = DALTypes;

const getPartyMemberType = (partyMember: string): MemberType => partyMember.toLowerCase() as MemberType;

const getReportStatus = (applicantReport: PartyApplicantReport, isReportRequired: boolean): ReportStatus => {
  if (isReportRequired) {
    return (applicantReport && (applicantReport.status as ReportStatus)) || ReportStatus.PENDING;
  }

  return ReportStatus.NOT_APPLICABLE;
};

const getApplicantReportStatus = (
  reportName: string,
  applicantReport: PartyApplicantReport,
  propertyApplicationSettings: IPropertyApplicationSettings,
  applicationSettingsFilter: IApplicationSettingsFilter,
): ReportStatus => {
  const { leaseType, memberType } = applicationSettingsFilter;
  const { applicationSettings } = propertyApplicationSettings;
  const partyTypeApplicationSettings = applicationSettings[leaseType];
  const memberTypeApplicationSettings = partyTypeApplicationSettings[memberType];

  const { creditReportRequiredFlag, criminalReportRequiredFlag } = memberTypeApplicationSettings;

  if (reportName === ApplicantReportNames.CREDIT) return getReportStatus(applicantReport, creditReportRequiredFlag);

  return getReportStatus(applicantReport, criminalReportRequiredFlag);
};

const getPersonApplicationData = (creditApplicantReport: PartyApplicantReport, criminalApplicantReport: PartyApplicantReport): IApplicationData => {
  if (creditApplicantReport) return creditApplicantReport.applicationData;
  if (criminalApplicantReport) return criminalApplicantReport.applicationData;

  return {} as IApplicationData;
};

const getApplicantReport = (reportStatus: ReportStatus, partyApplicantReport: PartyApplicantReport, reportName: string): ICreditReport | ICriminalReport => {
  const noReportData = reportName === ApplicantReportNames.CREDIT ? noCreditReportData : noCriminalReportData;
  return (reportStatus !== ReportStatus.NOT_APPLICABLE && partyApplicantReport && partyApplicantReport.reportData) || noReportData;
};

const getApplicantReportStatuses = (
  reports: Array<PartyApplicantReport>,
  propertyApplicationSettings: IPropertyApplicationSettings,
  applicationSettingsFilter: IApplicationSettingsFilter,
): ReportStatus[] => [
  getApplicantReportStatus(ApplicantReportNames.CREDIT, reports[0], propertyApplicationSettings, applicationSettingsFilter),
  getApplicantReportStatus(ApplicantReportNames.CRIMINAL, reports[1], propertyApplicationSettings, applicationSettingsFilter),
];

const hasReportStatus = (reportStatus: ReportStatus, statusToCompare: ReportStatus): boolean | null =>
  reportStatus !== ReportStatus.NOT_APPLICABLE ? reportStatus === statusToCompare : null;

const hasExpiredReport = (applicantReport: PartyApplicantReport, reportStatus: ReportStatus): boolean | null =>
  reportStatus !== ReportStatus.NOT_APPLICABLE ? get(applicantReport, 'isReportExpired', null) : null;

const getApplicantReportFlags = (
  { creditApplicantReport, criminalApplicantReport }: { creditApplicantReport: PartyApplicantReport; criminalApplicantReport: PartyApplicantReport },
  { creditReportStatus, criminalReportStatus }: { creditReportStatus: ReportStatus; criminalReportStatus: ReportStatus },
): IDictionaryHash<boolean | null> => ({
  hasCompletedCreditReport: hasReportStatus(creditReportStatus, ReportStatus.COMPLETED),
  hasCompletedCriminalReport: hasReportStatus(criminalReportStatus, ReportStatus.COMPLETED),
  hasCompilingCreditReport: hasReportStatus(creditReportStatus, ReportStatus.COMPILING),
  hasCompilingCriminalReport: hasReportStatus(criminalReportStatus, ReportStatus.COMPILING),
  hasPendingCreditReport: hasReportStatus(creditReportStatus, ReportStatus.PENDING),
  hasPendingCriminalReport: hasReportStatus(criminalReportStatus, ReportStatus.PENDING),
  hasCreditFreeze: hasReportStatus(creditReportStatus, ReportStatus.BLOCKED_CREDIT_FREEZE),
  hasDisputedCreditReport: hasReportStatus(creditReportStatus, ReportStatus.BLOCKED_DISPUTE),
  hasDisputedCriminalReport: hasReportStatus(criminalReportStatus, ReportStatus.BLOCKED_DISPUTE),
  hasAddressErroredCreditReport: hasReportStatus(creditReportStatus, ReportStatus.BLOCKED_ADDRESS),
  hasAddressErroredCriminalReport: hasReportStatus(criminalReportStatus, ReportStatus.BLOCKED_ADDRESS),
  hasErroredCreditReport: hasReportStatus(creditReportStatus, ReportStatus.ERROR),
  hasErroredCriminalReport: hasReportStatus(criminalReportStatus, ReportStatus.ERROR),
  hasExpiredCreditReport: hasExpiredReport(creditApplicantReport, creditReportStatus),
  hasExpiredCriminalReport: hasExpiredReport(criminalApplicantReport, criminalReportStatus),
});

const getDefaultServiceStatusFlags = (
  serviceStatusName: string,
  defaultCreditServiceStatusFlags: ICreditServiceErrors = defaultCreditReportServiceErrors,
  defaultCriminalServiceStatusFlags: ICriminalServiceErrors = defaultCriminalReportServiceErrors,
): ICreditServiceErrors | ICriminalServiceErrors =>
  serviceStatusName === ServiceNames.CREDIT ? defaultCreditServiceStatusFlags : defaultCriminalServiceStatusFlags;

const getApplicantReportErroredServices = (
  partyApplicantReport: PartyApplicantReport,
  serviceStatusName: string,
): ICreditServiceErrors | ICriminalServiceErrors => {
  if (!partyApplicantReport) return getDefaultServiceStatusFlags(serviceStatusName, defaultNoCreditReportServiceErrors, defaultNoCriminalReportServiceErrors);

  const { serviceStatus, serviceBlockedStatus } = partyApplicantReport;

  if (!serviceStatus || !serviceBlockedStatus) {
    return getDefaultServiceStatusFlags(serviceStatusName, defaultNoCreditReportServiceErrors, defaultNoCriminalReportServiceErrors);
  }

  const isServiceStatusBlocked = serviceStatus[serviceStatusName] ? isStatusBlocked(serviceStatus[serviceStatusName].status) : false;
  const blockedServiceStatusFlags = getDefaultServiceStatusFlags(serviceStatusName);

  if (!isServiceStatusBlocked) return blockedServiceStatusFlags;

  const blockedServiceErrors = BlockedServiceStatusErrorMapper[serviceStatusName];
  const serviceBlockedMessagePropertyName = BlockedServiceStatusMessageMapper[serviceStatusName];

  const serviceStatusFlags = Object.keys(blockedServiceStatusFlags).reduce(
    (acc, serviceStatusFlag) => {
      const hasBlockedStatusError =
        blockedServiceErrors[serviceStatusFlag] &&
        blockedServiceErrors[serviceStatusFlag].some(blockedStatusError => serviceBlockedStatus.includes(blockedStatusError));

      if (hasBlockedStatusError) {
        acc[serviceStatusFlag] = hasBlockedStatusError;
        acc[serviceBlockedMessagePropertyName] = serviceBlockedStatus;
      }

      return acc;
    },
    { ...blockedServiceStatusFlags },
  );

  if (!serviceStatusFlags[serviceBlockedMessagePropertyName]) {
    const unknownBlockFlagPropertyName = BlockedServiceUnknownErrorMapper[serviceStatusName];
    serviceStatusFlags[serviceBlockedMessagePropertyName] = serviceBlockedStatus;
    serviceStatusFlags[unknownBlockFlagPropertyName] = true;
  }

  return serviceStatusFlags;
};

const getApplicantsScreeningDecisionData = (
  // TODO: Ask Roberto why ctx is not used
  _ctx: IDbContext,
  partyApplicantData: Array<IPartyApplicantData>,
  propertyApplicationSettings: IPropertyApplicationSettings,
): IApplicantScreeningData[] =>
  partyApplicantData.map((personData: IPartyApplicantData) => {
    const { personId, creditApplicantReport, criminalApplicantReport, leaseType } = personData;
    const applicationData = getPersonApplicationData(creditApplicantReport, criminalApplicantReport);
    const memberType = getPartyMemberType(personData.memberType);
    const applicationSettingsFilter = { leaseType, memberType };

    const [creditReportStatus, criminalReportStatus] = getApplicantReportStatuses(
      [creditApplicantReport, criminalApplicantReport],
      propertyApplicationSettings,
      applicationSettingsFilter,
    );

    return {
      // TODO: this hack is used to avoid TS2783: ** is specified more than once, so this usage will be overwritten.
      ...{
        memberType,
        guarantors: [], // TODO: to be defined later, refer to ds-input.json
        personId,
      },
      ...getApplicantReportFlags({ creditApplicantReport, criminalApplicantReport }, { creditReportStatus, criminalReportStatus }),
      hasInternationalAddress: (applicationData && applicationData.haveInternationalAddress) || null,
      monthlyIncome: (applicationData && applicationData.grossIncomeMonthly) || null,
      liquidAssets: null, // TODO: to be defined later, refer to ds-input.json
      ...(getApplicantReport(creditReportStatus, creditApplicantReport, ApplicantReportNames.CREDIT) as IApplicantScreeningData),
      ...(getApplicantReport(criminalReportStatus, criminalApplicantReport, ApplicantReportNames.CRIMINAL) as IApplicantScreeningData),
      ...getApplicantReportErroredServices(creditApplicantReport, ServiceNames.CREDIT),
      ...getApplicantReportErroredServices(criminalApplicantReport, ServiceNames.CRIMINAL),
    };
  });

const getPropertyScreeningDecisionQuoteData = (propertyId: string, quotes: Array<IApplicationQuote>): IApplicationQuote[] => {
  if (!quotes.length) return [];

  const quotesForProperty = quotes.filter(quote => quote.propertyId === propertyId);
  return quotesForProperty.reduce((acc: Array<IApplicationQuote>, quote: IApplicationQuote) => {
    const { propertyId: propId, ...restOfQuoteProperties } = quote;
    acc.push(restOfQuoteProperties);
    return acc;
  }, []);
};

const getPartyType = (partyApplicantData: Array<IPartyApplicantData>): string => get(partyApplicantData, '[0].leaseType', PartyTypes.TRADITIONAL);

const getPropertyScreeningCriteria = (
  propertyId: string,
  partyApplicantData: Array<IPartyApplicantData>,
  partyScreeningCriterias: Array<IPartyScreeningCriteria>,
): IApplicationScreeningCriteria => {
  const partyType = getPartyType(partyApplicantData);

  const guarantorResidentRelationship = GuarantorResidentRelationship.INDIVIDUAL_GUARANTORS; // TODO: to be defined later, refer to ds-input.json
  return partyScreeningCriterias
    .filter(({ propertyId: id, partyType: screeningCriteriaPartyType }) => id === propertyId && screeningCriteriaPartyType === partyType)
    .map(({ screeningCriteria }) => ({ ...{ guarantorResidentRelationship }, ...screeningCriteria } as IApplicationScreeningCriteria))[0]; // TODO: remove hack to avoid TS2783 issue
};

const getScreeningDecisionData = async (
  ctx: IDbContext,
  quotePropertiesApplicationSettings: Array<IPropertyApplicationSettings>,
  partyApplicantData: Array<IPartyApplicantData>,
  partyScreeningCriterias: Array<IPartyScreeningCriteria>,
  partyQuotes: Array<IApplicationQuote>,
): Promise<IPartyApplicationScreeningData[]> =>
  await Promise.all(
    quotePropertiesApplicationSettings.map(async (propertyApplicationSettings: IPropertyApplicationSettings) => {
      const { propertyId } = propertyApplicationSettings;

      const partyApplicationScreeningData: IPartyApplicationScreeningData = {
        decisionId: getUUID() as string,
        applicants: await getApplicantsScreeningDecisionData(ctx, partyApplicantData, propertyApplicationSettings),
        quotes: getPropertyScreeningDecisionQuoteData(propertyId, partyQuotes),
        criteria: getPropertyScreeningCriteria(propertyId, partyApplicantData, partyScreeningCriterias),
      };

      return partyApplicationScreeningData;
    }),
  );

const getPartyApplicationQuoteData = async (ctx: IDbContext, partyId: string): Promise<IApplicationQuote[]> => {
  const partyPublishedQuotes = await getPublishedQuotesWithPropertyDataByPartyId(ctx, partyId);

  return partyPublishedQuotes.map(quote => {
    const leaseTerms = getPublishedQuoteDataWithMonthlyTotalCharges(quote.publishedQuoteData).leaseTerms || [];

    return {
      quoteId: quote.id,
      startDate: quote.leaseStartDate,
      quoteTerms: leaseTerms.map(leaseTerm => ({
        monthlyRent: (leaseTerm.overwrittenBaseRent !== 0 && leaseTerm.overwrittenBaseRent) || leaseTerm.originalBaseRent,
        monthlyTotalRent: leaseTerm.totalMonthlyCharges,
        termLength: leaseTerm.termLength,
      })),
      propertyId: quote.propertyId,
    };
  });
};

const getPartyApplicationSettings = async (ctx: IDbContext, partyId: string): Promise<IPropertyApplicationSettings[]> => {
  const quotePropertiesApplicationSettings: IPropertyApplicationSettings[] = await getPropertyApplicationSettingsFromPublishedQuotesByPartyId(ctx, partyId);

  if (quotePropertiesApplicationSettings.length) return quotePropertiesApplicationSettings;

  return await getPartyAssignedPropertyApplicationSettingsByPartyId(ctx, partyId);
};

const getScreeningCriteriaForProperties = async (
  ctx: IDbContext,
  propertyIds: Array<string>,
  partyApplicantData: Array<IPartyApplicantData>,
): Promise<IPartyScreeningCriteria[]> =>
  await getScreeningCriteriaByPropertyIds(ctx, propertyIds, { partyType: getPartyType(partyApplicantData), inactive: false });

const getPartyScreeningCriterias = async (
  ctx: IDbContext,
  quotePropertiesApplicationSettings: Array<IPropertyApplicationSettings>,
  partyApplicantData: Array<IPartyApplicantData>,
): Promise<IPartyScreeningCriteria[]> => {
  if (!quotePropertiesApplicationSettings.length) return [];

  const propertyIds = quotePropertiesApplicationSettings.map(({ propertyId }) => propertyId);
  return await getScreeningCriteriaForProperties(ctx, propertyIds, partyApplicantData);
};

export const getPartyScreeningDecisionData = async (ctx: IDbContext, partyId: string): Promise<IPartyApplicationScreeningData[]> => {
  logger.info({ ctx, partyId }, 'getPartyScreeningDecisionData');
  const quotePropertiesApplicationSettings = await getPartyApplicationSettings(ctx, partyId);
  const partyApplicantData = await getPartyApplicantData(ctx, partyId);
  const partyScreeningCriterias = await getPartyScreeningCriterias(ctx, quotePropertiesApplicationSettings, partyApplicantData);
  const quotes = await getPartyApplicationQuoteData(ctx, partyId);

  const screeningDecisionData = await getScreeningDecisionData(ctx, quotePropertiesApplicationSettings, partyApplicantData, partyScreeningCriterias, quotes);
  logger.debug(
    {
      ctx,
      partyId,
      numberOfDecisions: screeningDecisionData.length,
      decisionIds: screeningDecisionData.map(({ decisionId }) => decisionId).join(','),
      propertyIdApplicationSettings: quotePropertiesApplicationSettings.map(({ propertyId }) => propertyId).join(','),
      quoteIds: quotes.map(({ quoteId }) => quoteId).join(','),
    },
    'got screening decision data',
  );

  return screeningDecisionData;
};
