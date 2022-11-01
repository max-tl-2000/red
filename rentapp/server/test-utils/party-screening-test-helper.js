/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import { expect } from 'chai';
import { getQuotePropertyId } from './repo-helper';
import creditReport from '../services/__integration__/fixtures/basic-credit-applicant-report.json';
import criminalReport from '../services/__integration__/fixtures/basic-criminal-applicant-report.json';
import {
  noCreditReportData,
  noCriminalReportData,
  BlockedServiceErrors,
  defaultCreditReportServiceErrors,
  defaultCriminalReportServiceErrors,
} from '../services/helpers/party-application-helper';
import { ReportStatus } from '../helpers/party-application-screening-decision-types';

const PENDING = ReportStatus.PENDING;
const NOT_APPLICABLE = ReportStatus.NOT_APPLICABLE;

const expectBlockedServicesToEqual = (applicants, { expectedBlockedCriminalServiceFlags, expectedBlockedCreditServiceFlags }) => {
  applicants.forEach(applicant => {
    const blockedCriminalServicesSection = pick(applicant, Object.keys(expectedBlockedCriminalServiceFlags));
    const blockedCreditServicesSection = pick(applicant, Object.keys(expectedBlockedCreditServiceFlags));
    expect(
      blockedCriminalServicesSection,
      'Criminal blocked services section does not match the expected states provided in the party screening data',
    ).to.deep.equal(expectedBlockedCriminalServiceFlags);
    expect(
      blockedCreditServicesSection,
      'Credit blocked services section does not match the expected states provided in the party screening data',
    ).to.deep.equal(expectedBlockedCreditServiceFlags);
  });
};

export const expectBlockedServicesSectionToEqual = (partyScreeningData, expectedBlockedServices) => {
  partyScreeningData.forEach(({ applicants }) => expectBlockedServicesToEqual(applicants, expectedBlockedServices));
};

export const expectScreeningCriteriaToEqual = async (criteria, { quoteId, partyAssignedPropertyId }, expectedCriteria) => {
  const propertyId = await getQuotePropertyId(quoteId, partyAssignedPropertyId);
  const [result] = expectedCriteria.filter(({ propertyId: expectedResultPropertyId }) => expectedResultPropertyId === propertyId);
  expect(criteria, 'the criteria does not match the expected criteria settings on the provided party screening data').to.deep.equal(result.criteria);
};

export const expectCriteriaToEqual = async (partyScreeningData, partyAssignedPropertyId, expectedCriteria = []) => {
  await Promise.all(
    partyScreeningData.map(async ({ criteria, quotes }) => {
      await expectScreeningCriteriaToEqual(criteria, quotes[0] || { partyAssignedPropertyId }, expectedCriteria);
    }),
  );
};

export const expectNumberOfApplicantsToEqual = (partyScreeningData, expectedCount) => {
  partyScreeningData.forEach(({ applicants }) => {
    expect(applicants.length, 'the number of applicants does not match the expected number on the provided party screening data').to.equal(expectedCount);
  });
};

export const expectDecisionIdsToBeSet = partyScreeningData => {
  partyScreeningData.forEach(({ decisionId }) => {
    expect(decisionId, 'decisionId cannot be null').to.not.be.null;
  });
};

const expectNumberOfPartyMemberTypeToEqual = (applicants, memberType, memberTypeCount) => {
  expect(
    applicants.filter(applicant => applicant.memberType === memberType).length,
    'the number of party member type does not match the expected type on the provided party screening data',
  ).to.equal(memberTypeCount);
};

const expectNumberOfPartyMemberTypes = (applicants, memberTypeCounts) => {
  memberTypeCounts.forEach(({ memberType, memberTypeCount }) => {
    expectNumberOfPartyMemberTypeToEqual(applicants, memberType, memberTypeCount);
  });
};

export const expectPartyMemberTypesToEqual = (partyScreeningData, memberTypesAndCounts) => {
  partyScreeningData.forEach(({ applicants }) => {
    expectNumberOfPartyMemberTypes(applicants, memberTypesAndCounts);
  });
};

const getPropertyApplicantReportStatuses = async ({ quoteId, partyAssignedPropertyId }, applicantReportStatuses) => {
  const propertyId = await getQuotePropertyId(quoteId, partyAssignedPropertyId);

  return applicantReportStatuses
    .filter(reportStatus => reportStatus.every(statuses => statuses.propertyId === propertyId))
    .reduce((acc, reportStatuses) => acc.concat(reportStatuses), []);
};

const getNumberOfQuotesPerScreeningData = async ({ quoteId, partyAssignedPropertyId }, expectedNumberOfQuotesPerScreeningData) => {
  const propertyId = await getQuotePropertyId(quoteId, partyAssignedPropertyId);
  const [result] = expectedNumberOfQuotesPerScreeningData.filter(expectedNumberOfQuotes => expectedNumberOfQuotes.propertyId === propertyId);
  return result.numberOfQuotes;
};

const expectApplicantReportsStatusFlagsToEqual = (applicant, reportStatusFlags) => {
  const applicantReportStatusFlags = pick(applicant, Object.keys(reportStatusFlags));
  expect(applicantReportStatusFlags, 'the applicant report status flags do not match the expected flags').to.deep.equal(reportStatusFlags);
};

const expectApplicantReportsStatusesFlagsToEqual = async (applicants, { quoteId, partyAssignedPropertyId }, applicantReportStatuses) => {
  const statuses = await getPropertyApplicantReportStatuses({ quoteId, partyAssignedPropertyId }, applicantReportStatuses);

  applicants.map((applicant, index) => expectApplicantReportsStatusFlagsToEqual(applicant, statuses[index].statusFlags));
};

export const expectApplicantReportsStatusesSectionToEqual = async (partyScreeningData, partyAssignedPropertyId, reportStatuses = []) => {
  await Promise.all(
    partyScreeningData.map(async ({ applicants, quotes }) => {
      await expectApplicantReportsStatusesFlagsToEqual(applicants, quotes[0] || { partyAssignedPropertyId }, reportStatuses);
    }),
  );
};

export const expectNumberOfQuotesToEqual = async (partyScreeningData, partyAssignedPropertyId, expectedNumberOfQuotesPerScreeningData) => {
  await Promise.all(
    partyScreeningData.map(async ({ quotes }) => {
      const quotesCount = await getNumberOfQuotesPerScreeningData(quotes[0] || { partyAssignedPropertyId }, expectedNumberOfQuotesPerScreeningData);
      expect(quotes.length, 'the number of quotes does not match the expected quotes on the provided party screening data').to.equal(quotesCount);
    }),
  );
};

const isPendingOrNotApplicable = creditStatus => creditStatus === PENDING || creditStatus === NOT_APPLICABLE;

const expectApplicantReportToEqual = (applicant, { creditStatus, criminalStatus }) => {
  const applicantCreditReport = pick(applicant, Object.keys(creditReport));
  const applicantCriminalReport = pick(applicant, Object.keys(criminalReport));

  const expectedCreditReport = isPendingOrNotApplicable(creditStatus) ? noCreditReportData : creditReport;
  const expectedCriminalReport = isPendingOrNotApplicable(criminalStatus) ? noCriminalReportData : criminalReport;

  expect(applicantCreditReport, 'the applicant credit report does not match the expected report').to.deep.equal(expectedCreditReport);
  expect(applicantCriminalReport, 'the applicant criminal report does not match the expected report').to.deep.equal(expectedCriminalReport);
};

const expectApplicantReportsSectionsToEqual = async (applicants, { quoteId, partyAssignedPropertyId }, expectedReportStatuses) => {
  const statuses = await getPropertyApplicantReportStatuses({ quoteId, partyAssignedPropertyId }, expectedReportStatuses);

  applicants.forEach((applicant, index) => {
    expectApplicantReportToEqual(applicant, { creditStatus: statuses[index].creditStatus, criminalStatus: statuses[index].criminalStatus });
  });
};

export const expectApplicantReportsSectionToEqual = async (partyScreeningData, partyAssignedPropertyId, expectedReportStatuses) => {
  await Promise.all(
    partyScreeningData.map(async ({ applicants, quotes }) => {
      await expectApplicantReportsSectionsToEqual(applicants, quotes[0] || { partyAssignedPropertyId }, expectedReportStatuses);
    }),
  );
};

export const hasCriminalServiceError = {
  ...defaultCriminalReportServiceErrors,
  hasCriminalServiceError: true,
  blockedMessageOnCriminal: BlockedServiceErrors.CRIMINAL,
};

export const hasCreditBureauServiceError = {
  ...defaultCreditReportServiceErrors,
  hasCreditBureauError: true,
  blockedMessageOnCredit: BlockedServiceErrors.CREDIT_BUREAU,
};

export const unknownBlockedMessage = 'UNKNOWN BLOCKED STATUS';

export const hasUnknownCriminalServiceError = {
  ...defaultCriminalReportServiceErrors,
  hasUnknownBlockOnCriminal: true,
  blockedMessageOnCriminal: unknownBlockedMessage,
};

export const hasUnknownCreditServiceError = {
  ...defaultCreditReportServiceErrors,
  hasUnknownBlockOnCredit: true,
  blockedMessageOnCredit: unknownBlockedMessage,
};
