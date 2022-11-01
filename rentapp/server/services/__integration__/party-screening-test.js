/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { expect } from 'chai';
import { mapSeries } from 'bluebird';
import { getPartyScreeningDecisionData } from '../party-screening';
import { testCtx as ctx, createAParty, createAQuote, createAPropertyWithPartySettings } from '../../../../server/testUtils/repoHelper';
import { createUnitInventory, createScreeningPartyMember } from '../../test-utils/repo-helper';
import publishedQuoteData from './fixtures/sample-published-quote-data.json';
import { standardTraditionalCriteria, specialTraditionalCriteria } from './fixtures/property/settings/screening-criteria';
import { MemberType as ScreeningDecisionMemberType, ReportStatus } from '../../helpers/party-application-screening-decision-types';
import { getPartyData, PROPERTY_SCENARIOS, PARTY_TYPE } from './fixtures/screening/parties/screening-party-data';
import {
  expectApplicantReportsStatusesSectionToEqual,
  expectApplicantReportsSectionToEqual,
  expectNumberOfQuotesToEqual,
  expectPartyMemberTypesToEqual,
  expectNumberOfApplicantsToEqual,
  expectDecisionIdsToBeSet,
  expectCriteriaToEqual,
  expectBlockedServicesSectionToEqual,
  hasCriminalServiceError,
  hasCreditBureauServiceError,
  hasUnknownCriminalServiceError,
  hasUnknownCreditServiceError,
} from '../../test-utils/party-screening-test-helper';
import {
  completeReports,
  credCompleteCrimNotApplicable,
  credNotApplicableCrimPending,
  pendingReports,
  compilingReports,
  credNotApplicableCrimComplete,
  credErrorCrimNotApplicable,
  credPendingCrimNotApplicable,
  compilingCredCrimNotApplicable,
  compilingCrimCredNotApplicable,
} from './fixtures/screening/reports/applicant-reports-status-flags';
import {
  defaultCreditReportServiceErrors,
  defaultCriminalReportServiceErrors,
  defaultNoCriminalReportServiceErrors,
  defaultNoCreditReportServiceErrors,
} from '../helpers/party-application-helper';

const COMPLETE = ReportStatus.COMPLETED;
const PENDING = ReportStatus.PENDING;
const NOT_APPLICABLE = ReportStatus.NOT_APPLICABLE;
const COMPILING = ReportStatus.COMPILING;
const ERROR = ReportStatus.ERROR;

const { ALL_APPLICANT_REPORTS_REQUIRED, ONLY_CREDIT_REPORT_REQUIRED, ONLY_CRIMINAL_REPORT_REQUIRED } = PROPERTY_SCENARIOS;

const noBlockedServices = {
  expectedBlockedCriminalServiceFlags: defaultNoCriminalReportServiceErrors,
  expectedBlockedCreditServiceFlags: defaultNoCreditReportServiceErrors,
};

describe('services/getPartyScreeningDecisionData()', () => {
  let partyIds;
  let properties;
  let screeningPartyData;
  let partyScreeningScenarios;

  const initPartyData = async parties =>
    await mapSeries(Object.values(parties), async data => {
      const { partyData, partyMembers, quotes, blockedServiceStatus } = data;
      const { partyType, assignedProperty } = partyData;
      const party = await createAParty({ leaseType: partyType, assignedPropertyId: assignedProperty.id });

      await Promise.all(
        partyMembers.map(
          async (member, i) =>
            await createScreeningPartyMember({
              party,
              member: {
                memberName: `${party.id} - ${i}`,
                assignedProperty,
                ...member,
              },
              quotes,
              blockedServiceStatus,
            }),
        ),
      );

      await Promise.all(
        quotes.map(
          async quoteProperty =>
            await createAQuote(party.id, {
              inventoryId: (await createUnitInventory(quoteProperty.id)).id,
              leaseStartDate: new Date(),
              publishDate: new Date(),
              publishedQuoteData,
            }),
        ),
      );

      return party.id;
    });

  const checkPartyScreeningData = async (
    partyScreeningData,
    partyAssignedPropertyId,
    {
      expectedNumberOfPartyApplicationScreeningData,
      expectedNumberOfApplicants,
      expectedApplicantTypes,
      expectedReportStatuses,
      expectedNumberOfQuotesPerScreeningData,
      expectedCriteria,
      expectedBlockedServices = noBlockedServices,
    },
  ) => {
    expect(partyScreeningData).to.not.be.empty;
    expect(partyScreeningData.length).to.equal(expectedNumberOfPartyApplicationScreeningData);
    expectNumberOfApplicantsToEqual(partyScreeningData, expectedNumberOfApplicants);
    expectDecisionIdsToBeSet(partyScreeningData);
    expectPartyMemberTypesToEqual(partyScreeningData, expectedApplicantTypes);
    await expectNumberOfQuotesToEqual(partyScreeningData, partyAssignedPropertyId, expectedNumberOfQuotesPerScreeningData);
    await expectApplicantReportsStatusesSectionToEqual(partyScreeningData, partyAssignedPropertyId, expectedReportStatuses);
    await expectApplicantReportsSectionToEqual(partyScreeningData, partyAssignedPropertyId, expectedReportStatuses);
    await expectCriteriaToEqual(partyScreeningData, partyAssignedPropertyId, expectedCriteria);
    expectBlockedServicesSectionToEqual(partyScreeningData, expectedBlockedServices);
  };

  const getPartyId = partyScenario => partyIds[partyScenario.ID];
  const getAllReportsPropertyId = () => properties[ALL_APPLICANT_REPORTS_REQUIRED.ID].id;
  const getCreditReportPropertyId = () => properties[ONLY_CREDIT_REPORT_REQUIRED.ID].id;
  const getCriminalReportPropertyId = () => properties[ONLY_CRIMINAL_REPORT_REQUIRED.ID].id;

  describe('for traditional parties', () => {
    describe('and all applicant reports required', () => {
      beforeEach(async () => {
        properties = await mapSeries(
          Object.values(PROPERTY_SCENARIOS),
          async ({ settings, screeningCriterias }) => await createAPropertyWithPartySettings(settings, screeningCriterias),
        );
        screeningPartyData = getPartyData(properties);
        partyScreeningScenarios = screeningPartyData.ALL_REPORTS_REQUIRED;
        partyIds = await initPartyData(partyScreeningScenarios);
      });

      it('should return empty screening decision data for a non existing party', async () => {
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, getUUID());
        expect(partyScreeningData).to.deep.equal([]);
      });

      it('should return valid screening decision data for complete party with applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getAllReportsPropertyId() },
          { numberOfQuotes: 1, propertyId: getCreditReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and different report status', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getAllReportsPropertyId() },
          { numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
            { creditStatus: COMPLETE, criminalStatus: COMPLETE, propertyId: getAllReportsPropertyId(), statusFlags: completeReports },
          ],
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getAllReportsPropertyId() },
          { numberOfQuotes: 1, propertyId: getCreditReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
            { creditStatus: PENDING, criminalStatus: PENDING, propertyId: getAllReportsPropertyId(), statusFlags: pendingReports },
          ],
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getAllReportsPropertyId() },
          { numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data with service blocked error', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_WITH_SERVICE_BLOCKED_ERROR);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 2;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 0 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];
        const expectedBlockedServices = {
          expectedBlockedCriminalServiceFlags: hasCriminalServiceError,
          expectedBlockedCreditServiceFlags: defaultCreditReportServiceErrors,
        };

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
          expectedBlockedServices,
        });
      });

      it('should return valid screening decision data for complete party with applicant data with unknown service blocked error', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_WITH_UNKNOWN_SERVICE_BLOCKED_ERROR);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getAllReportsPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 2;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 1 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 1 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 0 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
            { creditStatus: COMPILING, criminalStatus: COMPILING, propertyId: getAllReportsPropertyId(), statusFlags: compilingReports },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getAllReportsPropertyId() }];
        const expectedCriteria = [{ criteria: standardTraditionalCriteria, propertyId: getAllReportsPropertyId() }];
        const expectedBlockedServices = {
          expectedBlockedCriminalServiceFlags: defaultCriminalReportServiceErrors,
          expectedBlockedCreditServiceFlags: hasUnknownCreditServiceError,
        };

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
          expectedBlockedServices,
        });
      });
    });

    describe('and single applicant report required', () => {
      beforeEach(async () => {
        properties = await mapSeries(
          Object.values(PROPERTY_SCENARIOS),
          async ({ settings, screeningCriterias }) => await createAPropertyWithPartySettings(settings, screeningCriterias),
        );
        screeningPartyData = getPartyData(properties);
        partyScreeningScenarios = screeningPartyData.SINGLE_REPORT_REQUIRED;
        partyIds = await initPartyData(partyScreeningScenarios);
      });

      it('should return empty screening decision data for a non existing party', async () => {
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, getUUID());
        expect(partyScreeningData).to.deep.equal([]);
      });

      it('should return valid screening decision data for complete party with applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getCreditReportPropertyId() },
          { numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data and different report status', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: ERROR, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credErrorCrimNotApplicable },
            { creditStatus: ERROR, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credErrorCrimNotApplicable },
            { creditStatus: ERROR, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credErrorCrimNotApplicable },
            { creditStatus: ERROR, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credErrorCrimNotApplicable },
            { creditStatus: ERROR, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credErrorCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getCriminalReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getCriminalReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with no applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 5;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
          [
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() },
          { numberOfQuotes: 1, propertyId: getCreditReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_HAS_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
            { creditStatus: COMPLETE, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credCompleteCrimNotApplicable },
          ],
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPLETE, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimComplete },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getCreditReportPropertyId() },
          { numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and no quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 0, propertyId: getCriminalReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and single quote', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_SINGLE_QUOTE);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and multiple quotes', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 2, propertyId: getCriminalReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() }];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for incomplete party with no applicant data and multiple quotes in different properties', async () => {
        const partyId = getPartyId(partyScreeningScenarios.NO_GUARANTORS_NO_APPLICANT_DATA_MULTIPLE_QUOTES_DIFFERENT_PROPERTIES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 2;
        const expectedNumberOfApplicants = 3;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 2 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 1 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
            { creditStatus: NOT_APPLICABLE, criminalStatus: PENDING, propertyId: getCriminalReportPropertyId(), statusFlags: credNotApplicableCrimPending },
          ],
          [
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
            { creditStatus: PENDING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: credPendingCrimNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [
          { numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() },
          { numberOfQuotes: 1, propertyId: getCreditReportPropertyId() },
        ];
        const expectedCriteria = [
          { criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() },
          { criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() },
        ];

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
        });
      });

      it('should return valid screening decision data for complete party with applicant data with credit bureau service blocked error', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS_WITH_SERVICE_BLOCKED_ERROR);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCreditReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 1;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 1 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 0 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 0 },
        ];
        const expectedReportStatuses = [
          [{ creditStatus: COMPILING, criminalStatus: NOT_APPLICABLE, propertyId: getCreditReportPropertyId(), statusFlags: compilingCredCrimNotApplicable }],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getCreditReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCreditReportPropertyId() }];
        const expectedBlockedServices = {
          expectedBlockedCriminalServiceFlags: defaultNoCriminalReportServiceErrors,
          expectedBlockedCreditServiceFlags: hasCreditBureauServiceError,
        };

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
          expectedBlockedServices,
        });
      });

      it('should return valid screening decision data for complete party with applicant data with unknown service blocked error', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_IN_DIFFERENT_STATUS_WITH_UNKNOWN_SERVICE_BLOCKED_ERROR);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        const partyAssignedPropertyId = getCriminalReportPropertyId();
        const expectedNumberOfPartyApplicationScreeningData = 1;
        const expectedNumberOfApplicants = 2;

        const expectedApplicantTypes = [
          { memberType: ScreeningDecisionMemberType.RESIDENT, memberTypeCount: 1 },
          { memberType: ScreeningDecisionMemberType.GUARANTOR, memberTypeCount: 1 },
          { memberType: ScreeningDecisionMemberType.OCCUPANT, memberTypeCount: 0 },
        ];
        const expectedReportStatuses = [
          [
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPILING, propertyId: getCriminalReportPropertyId(), statusFlags: compilingCrimCredNotApplicable },
            { creditStatus: NOT_APPLICABLE, criminalStatus: COMPILING, propertyId: getCriminalReportPropertyId(), statusFlags: compilingCrimCredNotApplicable },
          ],
        ];
        const expectedNumberOfQuotesPerScreeningData = [{ numberOfQuotes: 1, propertyId: getCriminalReportPropertyId() }];
        const expectedCriteria = [{ criteria: specialTraditionalCriteria, propertyId: getCriminalReportPropertyId() }];
        const expectedBlockedServices = {
          expectedBlockedCriminalServiceFlags: hasUnknownCriminalServiceError,
          expectedBlockedCreditServiceFlags: defaultNoCreditReportServiceErrors,
        };

        await checkPartyScreeningData(partyScreeningData, partyAssignedPropertyId, {
          expectedNumberOfPartyApplicationScreeningData,
          expectedNumberOfApplicants,
          expectedApplicantTypes,
          expectedReportStatuses,
          expectedNumberOfQuotesPerScreeningData,
          expectedCriteria,
          expectedBlockedServices,
        });
      });
    });
  });

  // TODO: corporate parties support will be handled in a separate ticket
  describe('for corporate parties', () => {
    describe('and all applicant reports required', () => {
      beforeEach(async () => {
        properties = await mapSeries(
          Object.values(PROPERTY_SCENARIOS),
          async ({ settings, screeningCriterias }) => await createAPropertyWithPartySettings(settings, screeningCriterias),
        );
        screeningPartyData = getPartyData(properties, PARTY_TYPE.CORPORATE);
        partyScreeningScenarios = screeningPartyData.ALL_REPORTS_REQUIRED;
        partyIds = await initPartyData(partyScreeningScenarios);
      });

      it('should return screening decision data', async () => {
        const partyId = getPartyId(partyScreeningScenarios.COMPLETE_HAS_APPLICANT_DATA_NO_QUOTES);
        const partyScreeningData = await getPartyScreeningDecisionData(ctx, partyId);
        expect(partyScreeningData).to.not.be.empty;
      });
    });
  });
});
