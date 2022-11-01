/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import getUUID from 'uuid/v4';
import { personId as personIdTestData, partialRawResponse, criteriaResults } from './fixtures/screening-helper-test-data';
import {
  getScreeningCriteriaAndResults,
  getApplicationDecisionByCriteria,
  getMappedPartyMemberToApplicant,
  formatApplicantsCreditScore,
} from '../screening-helper';
import { DALTypes } from '../../../../common/enums/DALTypes';

const { mockModules } = require('test-helpers/mocker').default(jest);
const { expect } = chai;

const getApplicant = ({ tenantId, applicantId, personId, firstName, lastName }) => ({
  AS_Information: [{ ApplicantIdentifier: [`${tenantId}:${applicantId}`] }],
  Customers: [
    {
      Customer: [
        {
          Identification: [{ $: { IDType: 'Applicant' }, IDValue: [personId] }],
          Name: [{ FirstName: [firstName], LastName: [lastName] }],
        },
      ],
    },
  ],
});

const getApplicantInformation = ({ tenantId, applicantId, fadvApplicantId, firstName, lastName, missingExternalId = true }) => ({
  $: { applicantid: fadvApplicantId },
  Applicant: [
    {
      ApplicantName: [`${firstName} ${lastName}`],
      ExternalId: missingExternalId ? undefined : [`${tenantId}:${applicantId}`],
    },
  ],
});

const ctx = { tenantId: getUUID() };

describe('Screening helper', () => {
  describe('When calling the getScreeningCriteriaAndResults function with applicantResults with the id with format "applicantId_applicantName"', () => {
    const partyMembers = [
      {
        personId: personIdTestData,
        fullName: 'Test Resident',
      },
    ];

    it('Should return the respective criteria results', () => {
      const { screeningCriteriaResults } = getScreeningCriteriaAndResults(ctx, partialRawResponse, criteriaResults, partyMembers);
      expect(screeningCriteriaResults).to.not.equal(null);
      Object.keys(screeningCriteriaResults).forEach(key => {
        const resultKey = Object.keys(screeningCriteriaResults[key])[0];
        expect(resultKey).to.equal(partyMembers[0].personId);
      });
    });
  });

  describe('Getting application decision by criteria', () => {
    it('Should return null for null input', () => {
      const result = getApplicationDecisionByCriteria(null);
      expect(result).to.equal(null);
    });
  });

  describe('Getting mapped party member to applicant', () => {
    const fadvApplicantId1 = '12345';
    const fadvApplicantId2 = '12346';
    const personId1 = getUUID();
    const personId2 = getUUID();
    const tenantId = getUUID();
    const applicantId1 = getUUID();
    const applicantId2 = getUUID();
    const partyMember1 = { id: 1, personId: personId1, fullName: 'Trisha Dean' };
    const partyMember2 = { id: 2, personId: personId2, fullName: 'Sutton Dean' };

    describe('when externalId is missing on applicantInformation', () => {
      const applicants = [
        getApplicant({ tenantId, applicantId: applicantId1, personId: personId1, firstName: 'Trisha', lastName: 'Dean' }),
        getApplicant({ tenantId, applicantId: applicantId2, personId: personId2, firstName: 'Sutton', lastName: 'Dean' }),
      ];
      const applicantsInformation = [
        getApplicantInformation({ tenantId, applicantId: applicantId1, fadvApplicantId: fadvApplicantId1, firstName: 'Trisha Ann', lastName: 'Dean' }),
        getApplicantInformation({ tenantId, applicantId: applicantId2, fadvApplicantId: fadvApplicantId2, firstName: 'Sutton', lastName: 'Dean' }),
      ];

      describe('and when the name from applicant is the same as member', () => {
        it('should return the exact match', () => {
          const partyMember = { ...partyMember1, fullName: 'Trisha Ann Dean' };
          const partyMembers = [partyMember, partyMember2];
          const result = getMappedPartyMemberToApplicant(ctx, { applicants, applicantsInformation, partyMembers, applicantId: fadvApplicantId1 });
          expect(result).to.eql(partyMember);
        });
      });

      describe('and when the name from applicant is not the same as member', () => {
        it('should return the closest match', () => {
          const partyMembers = [partyMember1, partyMember2];
          const result = getMappedPartyMemberToApplicant(ctx, { applicants, applicantsInformation, partyMembers, applicantId: fadvApplicantId1 });
          expect(result).to.eql(partyMember1);
        });

        it('should return the exact match', () => {
          const partyMember = { ...partyMember2, fullName: 'Sutton J Dean' };
          const partyMembers = [partyMember1, partyMember];
          const result = getMappedPartyMemberToApplicant(ctx, { applicants, applicantsInformation, partyMembers, applicantId: fadvApplicantId2 });
          expect(result).to.eql(partyMember);
        });
      });

      describe('and when the name from applicant doesnt match any member', () => {
        it('should return null', () => {
          const pm1 = { ...partyMember1, fullName: 'Other Name' };
          const pm2 = { ...partyMember1, fullName: 'Another Name' };
          const partyMembers = [pm1, pm2];
          const result = getMappedPartyMemberToApplicant(ctx, { applicants, applicantsInformation, partyMembers, applicantId: fadvApplicantId1 });
          expect(result).be.null;
        });
      });
    });

    describe('when externalId is present on applicantInformation', () => {
      const applicants = [
        getApplicant({ tenantId, applicantId: applicantId1, personId: personId1, firstName: 'Trisha', lastName: 'Dean' }),
        getApplicant({ tenantId, applicantId: applicantId2, personId: personId2, firstName: 'Sutton', lastName: 'Dean' }),
      ];
      const applicantsInformation = [
        getApplicantInformation({
          tenantId,
          applicantId: applicantId1,
          fadvApplicantId: fadvApplicantId1,
          firstName: 'Trisha Ann',
          lastName: 'Dean',
          missingExternalId: false,
        }),
        getApplicantInformation({
          tenantId,
          applicantId: applicantId2,
          fadvApplicantId: fadvApplicantId2,
          firstName: 'Sutton',
          lastName: 'Dean',
          missingExternalId: false,
        }),
      ];

      describe('and the names from member and applicant are different', () => {
        it('should return a match', () => {
          const partyMember = { ...partyMember1, fullName: 'Another name' };
          const partyMembers = [partyMember, partyMember2];
          const result = getMappedPartyMemberToApplicant(ctx, { applicants, applicantsInformation, partyMembers, applicantId: fadvApplicantId1 });
          expect(result).to.eql(partyMember);
        });
      });
    });

    describe('When someone cancels the quote promotion in the middle of getLatestQuotePromotion and getLeaseTerms', () => {
      it('Should still return the first unmatched screening result', async () => {
        jest.resetModules();
        mockModules({
          '../../../../server/services/party': {
            getLatestQuotePromotion: (ctx, partyId) => ({ leaseTermId: 'fd7f99df-420c-4bd5-a91b-e63f13d5f81f' }), // eslint-disable-line
            getPublishedLeaseTermsByPartyIdAndQuoteId: (tenantId, partyId) => [ // eslint-disable-line
              {
                id: 'UUID_THAT_DOESNT_MATCH',
                period: 'month',
                specials: false,
                termLength: 12,
                concessions: [],
                leaseNameId: '2dcaa4b4-487b-49af-8383-56b8139b9358',
                paymentSchedule: [
                  { amount: '1128.71', timeframe: 'May 2018' },
                  { amount: '3499.00', timeframe: 'Jun 2018 - Apr 2019' },
                  { amount: '2370.29', timeframe: 'May 2019' },
                ],
                originalBaseRent: 3267,
                chargeConcessions: [],
                adjustedMarketRent: 3499,
                overwrittenBaseRent: 3499,
                maxBakedFeesAdjustment: 6534,
                minBakedFeesAdjustment: '',
                allowBaseRentAdjustment: true,
              },
            ],
          },
          '../../../../server/services/quotePromotions': {
            getNonCanceledQuotePromotionByPartyId: (ctx, partyId) => ({ leaseTermId: 'fd7f99df-420c-4bd5-a91b-e63f13d5f81f' }), // eslint-disable-line
          },
        });
        const { getMostRecentScreeningResult } = require('../screening-helper'); // eslint-disable-line
        const args = {
          partyId: '7c66a2f4-70bc-4627-9e77-99750156216a',
          allowUnmatched: true,
          screeningResults: [
            {
              expected: true,
              rentData: { rent: 0, leaseTermMonths: [] },
              applicantData: { applicants: [] },
            },
          ],
        };
        const result = await getMostRecentScreeningResult(ctx, args);
        expect(result).to.eq(args.screeningResults[0]);
      });
    });

    describe('When getting the Most recent ScreeningRequest by Quote And Lease Term', () => {
      it('Should still return the most recent request', async () => {
        const leaseTermId = getUUID();
        const quoteId = getUUID();
        const leaseNameId = getUUID();
        const termLength = '12';
        jest.resetModules();
        mockModules({
          '../../../../server/services/leaseTerms': {
            getLeaseTermById: (ctx, leaseTermId) => ({ leaseNameId, termLength }), // eslint-disable-line
          },
        });
        const { getMostRecentScreeningRequestByQuoteAndTermId } = require('../screening-helper'); // eslint-disable-line
        const screeningRequests = [
          {
            quoteId: getUUID(),
            rentData: { leaseNameId, leaseTermMonths: termLength },
            created_at: '2018-07-20T00:00:00.000',
          },
          {
            quoteId,
            rentData: { leaseNameId, leaseTermMonths: termLength },
            created_at: '2018-06-20T00:00:00.000',
          },
          {
            quoteId,
            rentData: { leaseNameId, leaseTermMonths: termLength },
            created_at: '2017-05-20T00:00:00.000',
          },
          {
            quoteId,
            rentData: { leaseNameId: getUUID(), leaseTermMonths: termLength },
            created_at: '2017-05-22T00:00:00.000',
          },
          {
            quoteId,
            rentData: { leaseNameId, leaseTermMonths: '5' },
            created_at: '2017-05-23T00:00:00.000',
          },
        ];
        const result = await getMostRecentScreeningRequestByQuoteAndTermId(ctx, screeningRequests, quoteId, leaseTermId);
        expect(result.rentData.leaseNameId).to.equal(leaseNameId);
        expect(result.created_at).to.equal('2018-06-20T00:00:00.000');
      });
    });
  });

  describe('Get formatApplicantsCreditScore', () => {
    const applincantId1 = getUUID();
    const applincantId2 = getUUID();
    const applincantId3 = getUUID();

    const applicantsIdMap = { 104567: applincantId1, 123456: applincantId2, 165434: applincantId3 };
    const rentIcomesApplicants = [
      { ApplicantID: ['104567'], CreditScore: ['0'] },
      { ApplicantID: ['123456'], CreditScore: ['345'] },
      { ApplicantID: ['165434'], CreditScore: ['-'] },
    ];

    const creditInformation = formatApplicantsCreditScore(applicantsIdMap, rentIcomesApplicants);
    describe('When the applicants have a 0 credit score ', () => {
      it('Should return the thinFile credit assessment with the credit score', () => {
        const matchingCredit = creditInformation.find(ci => ci.applicantId === applincantId1);
        expect(matchingCredit.creditScore).to.equal(0);
        expect(matchingCredit.creditAssessment).to.equal(DALTypes.CreditAssessmentTypes.THIN_FILE);
      });
    });

    describe('When the applicants have a credit score greater than 0', () => {
      it('Should return the hasCredit credit assessment with the credit score', () => {
        const matchingCredit = creditInformation.find(ci => ci.applicantId === applincantId2);
        expect(matchingCredit.creditScore).to.equal(345);
        expect(matchingCredit.creditAssessment).to.equal(DALTypes.CreditAssessmentTypes.HAS_CREDIT);
      });
    });

    describe('When the applicants have a credit score "-"', () => {
      it('Should return the noFile credit assessment', () => {
        const matchingCredit = creditInformation.find(ci => ci.applicantId === applincantId3);
        expect(matchingCredit.creditAssessment).to.equal(DALTypes.CreditAssessmentTypes.NO_FILE);
      });
    });
  });
});
