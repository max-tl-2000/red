/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { DALTypes } from '../../../../../common/enums/DALTypes';
import * as IncomePoliciesSpecs from '../__specs__/fixtures/income-policies-test-specs';
import config from '../../../../config';
const { mockModules } = require('../../../../../common/test-helpers/mocker').default(jest);
const { newRequestThreshold } = config.fadv;

describe('screeningHandler', () => {
  let handleScreeningSubmitRequest;
  let applyIncomePolicies;

  const setupPaymentSchedule = amounts => amounts.map(amount => ({ amount }));

  const setupLeaseTerm = (leaseNameId, termLength, paymentSchedule, adjustedMarketRent) => ({ leaseNameId, termLength, paymentSchedule, adjustedMarketRent });

  const setupQuote = (leaseTerms, deposit) => ({
    leaseTerms,
    additionalAndOneTimeCharges: {
      oneTimeCharges: [
        {
          quoteSectionName: 'deposit',
          amount: deposit,
        },
      ],
    },
  });

  const personId = newId();
  const guarantorPersonId = newId();
  const propertyId = newId();
  const leaseNameId = newId();
  const partyApplicationId = newId();
  const applicantId = newId();
  const guarantorApplicantId = newId();

  const getValidQuote = () => setupQuote([setupLeaseTerm(leaseNameId, 1, setupPaymentSchedule([2000]), 2000)], 1000);

  const getPartyMembers = () => [{ personId, memberType: DALTypes.MemberType.RESIDENT }];
  const getPartyById = () => ({
    assignedPropertyId: propertyId,
  });
  const getPropertyTimeZone = () => 'America/Los_Angeles';
  const getPersonApplication = () => ({
    applicationData: { firstName: 'firstName', lastName: 'lastName' },
    partyApplicationId,
    applicantId,
  });
  const getPartyApplication = () => ({
    id: partyApplicationId,
  });

  const postToScreeningProvider = {
    response: {
      ApplicantScreening: {
        Response: [{ Status: ['Complete'] }],
      },
    },
    screeningRequestId: 0,
  };

  const getLeaseName = () => ({ propertyId });

  const defaultMocks = () => ({
    getAllQuotesByPartyId: jest.fn(() => [getValidQuote()]),
    getPublishedQuote: jest.fn(() => getValidQuote()),
    loadPartyMembers: jest.fn(() => getPartyMembers()),
    loadPartyById: jest.fn(() => getPartyById()),
    getLeaseNameById: jest.fn(() => getLeaseName()),
    getPersonApplicationByPersonIdAndPartyApplicationId: jest.fn(() => getPersonApplication()),
    getPartyApplicationByPartyId: jest.fn(() => getPartyApplication()),
    postToScreeningProvider: jest.fn(() => postToScreeningProvider),
    getAllScreeningResultsForParty: jest.fn(() => ({})),
    handleScreeningResponseReceived: jest.fn(() => ({})),
    getPropertySettings: jest.fn(() => ({})),
    getPropertyById: jest.fn(() => ({})),
    getScreeningPropertyId: jest.fn(() => ({})),
    getPropertyIncomePolicies: jest.fn(() => ({})),
    getRentData: jest.fn(() => ({})),
    getApplicants: jest.fn(() => []),
    getAmountOfNewSubmissionRequestsByPartyApplication: jest.fn(() => 0),
    markAllScreeningRequestsForPartyAsObsolete: jest.fn(() => ({})),
    getPropertyTimezone: jest.fn(() => getPropertyTimeZone()),
    isPartyLevelGuarantor: jest.fn(() => false),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../../../../server/services/quotes': {
        getAllQuotesByPartyId: mocks.getAllQuotesByPartyId,
        getPublishedQuote: mocks.getPublishedQuote,
      },
      '../../../../../server/dal/partyRepo': {
        loadPartyMembers: mocks.loadPartyMembers,
        loadPartyById: mocks.loadPartyById,
      },
      '../../../../../server/dal/propertyRepo': {
        getPropertySettings: mocks.getPropertySettings,
        getPropertyById: mocks.getPropertyById,
      },
      '../../../../../server/dal/leaseTermRepo': {
        getLeaseNameById: mocks.getLeaseNameById,
      },
      '../../../services/person-application': {
        getPersonApplicationByPersonIdAndPartyApplicationId: mocks.getPersonApplicationByPersonIdAndPartyApplicationId,
      },
      '../screening-provider-integration': {
        postToScreeningProvider: mocks.postToScreeningProvider,
      },
      '../screening-handler-response': {
        handleScreeningResponseReceived: mocks.handleScreeningResponseReceived,
      },
      '../screening-helper': {
        getScreeningPropertyId: mocks.getScreeningPropertyId,
        getPropertyIncomePolicies: mocks.getPropertyIncomePolicies,
        getRentData: mocks.getRentData,
        getApplicants: mocks.getApplicants,
      },
      '../../../services/screening': {
        getAllScreeningResultsForParty: mocks.getAllScreeningResultsForParty,
        markAllScreeningRequestsForPartyAsObsolete: mocks.markAllScreeningRequestsForPartyAsObsolete,
      },
      '../../../../server/dal/party-application-repo': {
        getPartyApplicationByPartyId: mocks.getPartyApplicationByPartyId,
      },
      '../../../../server/dal/fadv-submission-repo': {
        getAmountOfNewSubmissionRequestsByPartyApplication: mocks.getAmountOfNewSubmissionRequestsByPartyApplication,
      },
      '../../../../../server/services/party-settings': {
        isPartyLevelGuarantor: mocks.isPartyLevelGuarantor,
      },
      '../../../../../common/server/notificationClient': {
        notify: () => ({}),
      },
    });
    const screeningHandler = require('../v1/screening-report-request-handler'); // eslint-disable-line global-require
    handleScreeningSubmitRequest = screeningHandler.handleScreeningSubmitRequest;
  };

  const setupIncomePoliciesMocks = policies => {
    mockModules({
      '../screening-helper': {
        getPropertyIncomePolicies: jest.fn(() => policies),
      },
    });

    const screening = require('../v1/screening-report-request-handler'); // eslint-disable-line global-require
    applyIncomePolicies = screening.applyIncomePolicies;
  };

  describe('when calling applyIncomePolicies function', () => {
    const ctx = {
      tenantId: newId(),
    };

    beforeEach(() => {
      jest.resetModules();
    });

    const executeApplyIncomePoliciesTest = async testCaseSpecs => {
      const { members, expectedResidents, expectedGuarantors } = testCaseSpecs;

      await applyIncomePolicies(ctx, propertyId, members);

      const residents = members.reduce((acc, { partyMember, personApplication }) => {
        if (partyMember.memberType !== DALTypes.MemberType.RESIDENT) return acc;
        acc.push({
          id: partyMember.id,
          grossIncomeMonthly: personApplication.applicationData.grossIncomeMonthly,
          guaranteedBy: partyMember.guaranteedBy,
        });
        return acc;
      }, []);

      expect(residents).toEqual(expectedResidents);

      const guarantors = members.reduce((acc, { partyMember, personApplication }) => {
        if (partyMember.memberType !== DALTypes.MemberType.GUARANTOR) return acc;
        acc.push({
          id: partyMember.id,
          grossIncomeMonthly: personApplication.applicationData.grossIncomeMonthly,
        });
        return acc;
      }, []);

      expect(guarantors).toEqual(expectedGuarantors);
    };

    describe('and there are 4 roommates and 1 guarantor linked to 3 roommates', () => {
      it('should apply the COMBINED and PRORATED POOL policies to roommates and guarantors', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.PRORATED_POOL,
        });
        await executeApplyIncomePoliciesTest(IncomePoliciesSpecs.CASE_FOUR_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_THREE);
      });
      it('should apply the roommates INDIVIDUAL policy and the guarantors PRORATED POOL policy', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.INDIVIDUAL,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.PRORATED_POOL,
        });
        await executeApplyIncomePoliciesTest(
          IncomePoliciesSpecs.CASE_FOUR_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_THREE_WITH_INDIVIDUAL_AND_PRORATED_POOL_POLICIES,
        );
      });
      it('should apply the roommates COMBINED policy and the guarantors INDIVIDUAL policy', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.INDIVIDUAL,
        });
        await executeApplyIncomePoliciesTest(IncomePoliciesSpecs.CASE_FOUR_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_THREE_WITH_COMBINED_AND_INDIVIDUAL_POLICIES);
      });
    });

    describe('and there are 4 roommates and 2 guarantors, the first guarantor linked to 2 roommates and the second linked to 1', () => {
      it('should apply the COMBINED and PRORATED POOL policies to roommates and guarantors', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.PRORATED_POOL,
        });
        await executeApplyIncomePoliciesTest(IncomePoliciesSpecs.CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_THREE);
      });
      it('should apply the roommates INDIVIDUAL policy and the guarantors PRORATED POOL policy', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.INDIVIDUAL,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.PRORATED_POOL,
        });
        await executeApplyIncomePoliciesTest(
          IncomePoliciesSpecs.CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_THREE_WITH_PERMUTATED_POLICIES_WITH_INDIVIDUAL_AND_PRORATED_POOL_POLICIES,
        );
      });
      it('should apply the roommates COMBINED policy and the guarantors INDIVIDUAL policy', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.INDIVIDUAL,
        });
        await executeApplyIncomePoliciesTest(
          IncomePoliciesSpecs.CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_THREE_WITH_PERMUTATED_POLICIES_WITH_COMBINED_AND_INDIVIDUAL_POLICIES,
        );
      });
    });

    describe('and there are 4 roommates and 2 guarantors linked to 2 roommates each', () => {
      it('should apply the COMBINED and PRORATED POOL policies to roommates and guarantors', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.PRORATED_POOL,
        });
        await executeApplyIncomePoliciesTest(IncomePoliciesSpecs.CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_ALL_WITH_LOWER_INCOMES);
      });
    });

    describe('and there are 2 roommates and 1 guarantor linked to 1', () => {
      it('should apply the COMBINED and PRORATED POOL policies to roommates and guarantors', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.PRORATED_POOL,
        });
        await executeApplyIncomePoliciesTest(IncomePoliciesSpecs.CASE_TWO_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_ONE);
      });
      it('should apply the roommates COMBINED policy and the guarantors INDIVIDUAL policy', async () => {
        setupIncomePoliciesMocks({
          incomePolicyRoommates: DALTypes.IncomePolicyRoommates.COMBINED,
          incomePolicyGuarantors: DALTypes.IncomePolicyGuarantors.INDIVIDUAL,
        });
        await executeApplyIncomePoliciesTest(
          IncomePoliciesSpecs.CASE_TWO_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_ONE_WITH_PERMUTATED_POLICIES_WITH_COMBINED_AND_INDIVIDUAL_POLICIES,
        );
      });
    });
  });

  describe('handleScreeningSubmitRequest', () => {
    let msg;
    let mocks;

    beforeEach(() => {
      msg = {
        tenantId: newId(),
        partyId: newId(),
      };
    });

    it.skip('should call postToScreeningProvider once with valid parameters ', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);

      expect(mocks.postToScreeningProvider).toHaveBeenCalled();
      expect(mocks.postToScreeningProvider.mock.calls[0][0]).toEqual(propertyId);
      expect(mocks.postToScreeningProvider.mock.calls[0][1]).toEqual({
        deposit: 1000,
        leaseTermMonths: 1,
        rent: 2000,
        leaseNameId,
      });
      expect(mocks.postToScreeningProvider.mock.calls[0][2]).toEqual({
        applicants: [
          {
            firstName: 'firstName',
            lastName: 'lastName',
            type: 'Applicant',
            personId,
            applicantId,
          },
        ],
        tenantId: msg.tenantId,
        partyApplicationId,
      });
      expect(result.processed).toEqual(true);
    });

    it('should not call getAllQuotesByPartyId and getPublishedQuote when rentData is provided', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      msg = {
        ...msg,
        partyId: newId(),
        rentData: { rent: 1343.94, leaseTermMonths: 1, deposit: 1000 },
      };

      const result = await handleScreeningSubmitRequest(msg);
      expect(mocks.getAllQuotesByPartyId.mock.calls.length).toEqual(0);
      expect(mocks.getPublishedQuote.mock.calls.length).toEqual(0);
      expect(result.processed).toEqual(true);
    });

    it('should not call postToScreeningProvider when partyId is missing', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      delete msg.partyId;
      const result = await handleScreeningSubmitRequest(msg);
      expect(mocks.postToScreeningProvider.mock.calls.length).toEqual(0);
      expect(result.processed).toEqual(true); // we do not retry these
    });

    it('should not call postToScreeningProvider when there are not partyMembers for the given partyId', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      mocks = {
        ...defaultMocks(),
        loadPartyMembers: jest.fn(() => []),
      };
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);
      expect(mocks.postToScreeningProvider.mock.calls.length).toEqual(0);
      expect(result.processed).toEqual(true); // we do not retry these
    });

    it('should call postToScreeningProvider when a NEW request is under the threshold limit', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);

      expect(mocks.postToScreeningProvider).toHaveBeenCalled();
      expect(result.processed).toEqual(true);
    });

    it('should not call postToScreeningProvider when a NEW request is over the threshold limit', async () => {
      mocks = {
        ...defaultMocks(),
        getAmountOfNewSubmissionRequestsByPartyApplication: jest.fn(() => newRequestThreshold),
      };
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);

      expect(mocks.postToScreeningProvider.mock.calls.length).toEqual(0);
      expect(result.processed).toEqual(true);
    });

    it('should call postToScreeningProvider when a NEW request is over the threshold limit with override set', async () => {
      const partyApplication = {
        ...getPartyApplication(),
        overrideNewCountChecks: true,
      };

      mocks = {
        ...defaultMocks(),
        getPartyApplicationByPartyId: jest.fn(() => partyApplication),
        getAmountOfNewSubmissionRequestsByPartyApplication: jest.fn(() => newRequestThreshold),
      };
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);

      expect(mocks.postToScreeningProvider).toHaveBeenCalled();
      expect(result.processed).toEqual(true);
    });

    it('should not call postToScreeningProvider when a NEW request is over the threshold limit with no override', async () => {
      const partyApplication = {
        ...getPartyApplication(),
        overrideNewCountChecks: false,
      };

      mocks = {
        ...defaultMocks(),
        getPartyApplicationByPartyId: jest.fn(() => partyApplication),
        getAmountOfNewSubmissionRequestsByPartyApplication: jest.fn(() => newRequestThreshold),
      };
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);

      expect(mocks.postToScreeningProvider.mock.calls.length).toEqual(0);
      expect(result.processed).toEqual(true);
    });

    // TODO will be fixed on CPM-9446
    it.skip('should call postToScreeningProvider once with valid parameters when there is a guarantor', async () => {
      mocks = {
        ...defaultMocks(),
        loadPartyMembers: jest.fn(() => [
          { personId, memberType: DALTypes.MemberType.RESIDENT, guaranteedBy: guarantorApplicantId },
          {
            id: guarantorApplicantId,
            personId: guarantorPersonId,
            memberType: DALTypes.MemberType.GUARANTOR,
          },
        ]),
        getPersonApplicationByPersonIdAndPartyApplicationId: jest
          .fn()
          .mockImplementationOnce((tenantIdArg, personIdArg) => ({
            persondId: personIdArg,
            applicationData: { firstName: 'Juan', lastName: 'Perata' },
            partyApplicationId,
            applicantId,
          }))
          .mockImplementationOnce((tenantIdArg, personIdArg) => ({
            persondId: personIdArg,
            applicationData: { firstName: 'Luis', lastName: 'Lurita' },
            partyApplicationId,
            applicantId: guarantorApplicantId,
          })),
      };
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);
      expect(mocks.postToScreeningProvider).toHaveBeenCalled();
      expect(mocks.postToScreeningProvider.mock.calls[0][0]).toEqual(propertyId);
      expect(mocks.postToScreeningProvider.mock.calls[0][1]).toEqual({
        deposit: 1000,
        leaseTermMonths: 1,
        rent: 2000,
        leaseNameId,
      });
      expect(mocks.postToScreeningProvider.mock.calls[0][2]).toEqual({
        applicants: [
          {
            firstName: 'Juan',
            lastName: 'Perata',
            type: 'Applicant',
            personId,
            applicantId,
          },
          {
            firstName: 'Luis',
            lastName: 'Lurita',
            type: 'Guarantor',
            personId: guarantorPersonId,
            guarantorFor: `${msg.tenantId}:${applicantId}`,
            applicantId: guarantorApplicantId,
          },
        ],
        tenantId: msg.tenantId,
        partyApplicationId,
      });
      expect(result.processed).toEqual(true);
    });

    // TODO will be fixed on CPM-9446
    it.skip('should call postToScreeningProvider only once with valid parameters when there is a previous screening response', async () => {
      mocks = {
        ...defaultMocks(),
        getAllScreeningResultsForParty: jest.fn(() => ({
          screeningResults: [{ applicantData: {}, externalId: 12345 }],
        })),
      };
      setupMocks(mocks);

      const result = await handleScreeningSubmitRequest(msg);

      expect(mocks.postToScreeningProvider).toHaveBeenCalled();
      expect(mocks.postToScreeningProvider.mock.calls[0][0]).toEqual(propertyId);
      expect(mocks.postToScreeningProvider.mock.calls[0][1]).toEqual({
        deposit: 1000,
        leaseTermMonths: 1,
        rent: 2000,
        leaseNameId,
      });
      expect(mocks.postToScreeningProvider.mock.calls[0][2]).toEqual({
        applicants: [
          {
            firstName: 'firstName',
            lastName: 'lastName',
            type: 'Applicant',
            personId,
            applicantId,
          },
        ],
        tenantId: msg.tenantId,
        partyApplicationId,
      });
      expect(mocks.postToScreeningProvider.mock.calls[0][3]).toEqual({
        reportId: 12345,
        requestType: 'Modify',
        storeRequest: true,
      });
      expect(result.processed).toEqual(true);
    });
  });
});
