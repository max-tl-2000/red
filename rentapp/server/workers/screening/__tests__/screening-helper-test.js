/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai, { expect } from 'chai';
import path from 'path';
import chaiAsPromised from 'chai-as-promised';
import getUUID from 'uuid/v4';
import cloneDeep from 'lodash/cloneDeep';
import {
  getHighestMonthlyRentFromQuotes,
  getApplicants,
  checkApplicantsRoleChange,
  checkApplicantsRemoved,
  shouldStoreScreeningResponse,
} from '../screening-helper';
import { DALTypes } from '../../../../../common/enums/DALTypes';
import { read } from '../../../../../common/helpers/xfs';

chai.use(chaiAsPromised);

describe('screening helper', () => {
  const tenantId = getUUID();
  describe('getHighestMonthlyRentFromQuotes', () => {
    const setupLeaseTerm = (termLength, paymentSchedule, adjustedMarketRent) => ({
      termLength,
      paymentSchedule,
      adjustedMarketRent,
    });

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

    it('should return the highest monthly rent when there is one lease term in the quote', async () => {
      const paymentSchedule = [
        {
          amount: 1473.26,
          timeframe: 'Oct 2016',
        },
        {
          amount: 2326.2,
          timeframe: 'Nov 2016 - Mar 2017',
        },
        {
          amount: 852.94,
          timeframe: 'Apr 2017',
        },
      ];
      const termLength = 6;

      const leaseTerm = setupLeaseTerm(termLength, paymentSchedule, 2326.2);
      const leaseTerms = [leaseTerm];
      const quote = setupQuote(leaseTerms);

      const rentData = await getHighestMonthlyRentFromQuotes([quote]);
      expect(rentData.leaseTermMonths).to.equal(6);
      expect(rentData.rent).to.equal(2326.2);
    });

    it('should return a highest monthly when there are two lease term in the quote', async () => {
      const paymentSchedule1 = [
        {
          amount: 1740.26,
          timeframe: 'Oct 2016',
        },
        {
          amount: 2500.5,
          timeframe: 'Nov 2016 - Dic 2016',
        },
      ];
      const termLength1 = 3;

      const paymentSchedule2 = [
        {
          amount: 1343.94,
          timeframe: 'Oct 2016',
        },
        {
          amount: 2122.0,
          timeframe: 'Nov 2016 - Sep 2017',
        },
        {
          amount: 778.06,
          timeframe: 'Oct 2017',
        },
      ];
      const termLength2 = 12;

      const leaseTerm1 = setupLeaseTerm(termLength1, paymentSchedule1, 2500.5);
      const leaseTerm2 = setupLeaseTerm(termLength2, paymentSchedule2, 2122.0);
      const leaseTerms = [leaseTerm1, leaseTerm2];
      const quote = setupQuote(leaseTerms);

      const rentData = await getHighestMonthlyRentFromQuotes([quote]);
      expect(rentData.leaseTermMonths).to.equal(3);
      expect(rentData.rent).to.equal(2500.5);
    });

    it('should return a deposit when its available in the quote', async () => {
      const paymentSchedule = [
        {
          amount: 1473.26,
          timeframe: 'Oct 2016',
        },
        {
          amount: 2326.2,
          timeframe: 'Nov 2016 - Mar 2017',
        },
        {
          amount: 852.94,
          timeframe: 'Apr 2017',
        },
      ];
      const termLength = 6;
      const deposit = 2000;

      const leaseTerm = setupLeaseTerm(termLength, paymentSchedule, 2326.2);
      const leaseTerms = [leaseTerm];
      const quote = setupQuote(leaseTerms, deposit);

      const rentData = getHighestMonthlyRentFromQuotes([quote]);
      expect(rentData.leaseTermMonths).to.equal(6);
      expect(rentData.rent).to.equal(2326.2);
      expect(rentData.deposit).to.equal(deposit);
    });

    it('should return exception when payment schedule is missing in a quote ', () => {
      const paymentSchedule = null;
      const termLength = 6;

      const leaseTerm = setupLeaseTerm(termLength, paymentSchedule, null);
      const leaseTerms = [leaseTerm];
      const quote = setupQuote(leaseTerms);
      const callFn = () => getHighestMonthlyRentFromQuotes([quote]);
      expect(callFn).to.throw(Error, 'leaseTerm.adjustedMarketRent null or empty');
    });
  });

  describe('getApplicants', () => {
    it('should return an array of applicant when there is a partyMember and personApplication valid', async () => {
      const partyMemberAndPersonApplicationList = [
        {
          partyMember: {
            personId: 'f59fbc68-cf46-4067-85c5-9e89546111b4',
            memberType: DALTypes.MemberType.RESIDENT,
          },
          personApplication: {
            applicationData: {
              firstName: 'Harry',
              lastName: 'Potter',
            },
          },
        },
      ];

      const applicants = getApplicants({ tenantId }, { partyMemberAndPersonApplicationList });
      expect(applicants.length).to.equal(1);
      const applicant = applicants[0];
      expect(applicant.firstName).to.equal('Harry');
      expect(applicant.lastName).to.equal('Potter');
      expect(applicant.personId).to.equal('f59fbc68-cf46-4067-85c5-9e89546111b4');
      expect(applicant.type).to.equal('Applicant');
    });

    it('should return an array of applicant when there are two partyMembers and personApplications valid', async () => {
      const partyMemberAndPersonApplicationList = [
        {
          partyMember: {
            personId: 'f59fbc68-cf46-4067-85c5-9e89546111b4',
            memberType: DALTypes.MemberType.RESIDENT,
          },
          personApplication: {
            applicationData: {
              firstName: 'Harry',
              lastName: 'Potter',
            },
          },
        },
        {
          partyMember: {
            personId: 'f59fbc68-cf46-4067-85c5-9e89546111b5',
            memberType: DALTypes.MemberType.OCCUPANT,
          },
          personApplication: {
            applicationData: {
              firstName: 'Ron',
              lastName: 'Weasley',
            },
          },
        },
      ];

      const applicants = getApplicants({ tenantId }, { partyMemberAndPersonApplicationList });
      expect(applicants.length).to.equal(2);

      let applicant = applicants[0];
      expect(applicant.firstName).to.equal('Harry');
      expect(applicant.lastName).to.equal('Potter');
      expect(applicant.personId).to.equal('f59fbc68-cf46-4067-85c5-9e89546111b4');
      expect(applicant.type).to.equal('Applicant');

      applicant = applicants[1];
      expect(applicant.firstName).to.equal('Ron');
      expect(applicant.lastName).to.equal('Weasley');
      expect(applicant.personId).to.equal('f59fbc68-cf46-4067-85c5-9e89546111b5');
      expect(applicant.type).to.equal('Occupant');
    });
  });
});

describe('checkApplicantsRoleChange', () => {
  const personIds = [getUUID(), getUUID()];
  const applicants = [
    { personId: personIds[0], type: DALTypes.PartyStateType.APPLICANT },
    { personId: personIds[1], type: DALTypes.MemberType.GUARANTOR },
  ];
  const partyMembers = [
    { personId: personIds[0], memberType: DALTypes.MemberType.RESIDENT },
    { personId: personIds[1], memberType: DALTypes.MemberType.GUARANTOR },
  ];

  const updatePartyMembersRole = role => partyMembers.map(pm => ({ ...pm, memberType: role }));

  describe('When the role of a Resident has changed to Guarantor', () => {
    it('should return true ', () => {
      expect(checkApplicantsRoleChange(updatePartyMembersRole(DALTypes.MemberType.GUARANTOR), applicants)).to.equal(true);
    });
  });

  describe('When the role of a Guarantor  has changed to Resident', () => {
    it('should return true ', () => {
      expect(checkApplicantsRoleChange(updatePartyMembersRole(DALTypes.MemberType.RESIDENT), applicants)).to.equal(true);
    });
  });

  describe('When the role of a party member has not changed', () => {
    it('should return false ', () => {
      expect(checkApplicantsRoleChange(partyMembers, applicants)).to.equal(false);
    });
  });
});

describe('checkApplicantsRemoved', () => {
  const personIds = [getUUID(), getUUID()];
  const applicants = [
    { personId: personIds[0], type: DALTypes.PartyStateType.APPLICANT },
    { personId: personIds[1], type: DALTypes.MemberType.GUARANTOR },
  ];
  const inactivePartyMembers = [{ personId: personIds[1], memberType: DALTypes.MemberType.GUARANTOR }];

  describe('When a member is removed', () => {
    it('should return true ', () => {
      expect(checkApplicantsRemoved(inactivePartyMembers, applicants)).to.equal(true);
    });
  });

  describe('When all members are the same', () => {
    it('should return false ', () => {
      expect(checkApplicantsRemoved([], applicants)).to.equal(false);
    });
  });
});

const updateServiceStatus = (serviceStatus, applicantId) => {
  const serviceStatusToModify = cloneDeep(serviceStatus);
  const serviceForApplicant = serviceStatusToModify[applicantId];
  serviceForApplicant[0].status = 'COMPLETE';
  serviceStatusToModify[applicantId] = serviceForApplicant;

  return serviceStatusToModify;
};

const updateCriteriaResult = (criterias, key) => {
  const criteriasToModify = cloneDeep(criterias);
  const criteria = criteriasToModify[key];
  criteria.passFail = 'F';
  criteriasToModify[key] = criteria;

  return criteriasToModify;
};

describe('when using the shouldStoreScreeningResponse function', () => {
  const ctx = { tenantId: getUUID() };
  const serviceStatus = {
    'cb8e17b8-50b4-4587-8d88-0c86620d943e': [
      {
        status: 'IN PROCESS',
        serviceName: 'Collections',
      },
      {
        status: 'COMPLETE',
        serviceName: 'Criminal',
      },
    ],
    'ef8e17b8-50b4-4587-8d88-0c86450d943e': [
      {
        status: 'COMPLETE',
        serviceName: 'Criminal',
      },
    ],
  };

  const applicantDecision = { result: 'APPROVED', applicantId: '54eb6b26-3e8d-4b0b-ac9a-853b76748e67' };
  const applicationDecision = 'APPROVED';
  const criteriaResult = {
    305: {
      override: '2025',
      passFail: 'P',
      criteriaId: '305',
      criteriaType: 'CM',
      applicantResults: { 31758: 'P' },
      criteriaDescription: 'There are no exact name matches on the OFAC watch list.',
    },
    321: {
      override: 'None',
      passFail: 'P',
      criteriaId: '321',
      criteriaType: 'CM',
      applicantResults: { 31758: 'P' },
      criteriaDescription: 'Applicant has no felony drug records in the last 70 years.',
    },
  };

  const getBackgroundReport = async buildBackgroundReport => {
    if (!buildBackgroundReport) return null;
    const report = await read(path.resolve(path.dirname(__dirname), '__tests__', 'resources', 'backbround-report.html'));
    return buildBackgroundReport(report);
  };

  const responses = [
    {
      currentResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      expectedResult: true,
      description: 'there is no previous response',
      buildBackgroundReport: report => ({ current: report }),
    },
    {
      currentResponse: {
        serviceStatus,
        applicantDecision: [
          {
            applicantId: '7525041c-edbe-4a3a-bd31-4d292b3d747a',
            result: '',
          },
          {
            applicantId: '93c46b70-f51b-4e50-b097-df1f90858838',
            result: '',
          },
        ],
        applicationDecision,
        criteriaResult,
      },
      previousResponse: {
        serviceStatus,
        applicantDecision: [
          {
            result: '',
            applicantId: '7525041c-edbe-4a3a-bd31-4d292b3d747a',
          },
          {
            result: '',
            applicantId: '93c46b70-f51b-4e50-b097-df1f90858838',
          },
        ],
        applicationDecision,
        criteriaResult,
      },
      expectedResult: false,
      description: 'current response and previous response have the same data',
      condition: 'not',
      buildBackgroundReport: report => ({ current: report, previous: report }),
    },
    {
      currentResponse: {
        serviceStatus: { ...updateServiceStatus(serviceStatus, 'cb8e17b8-50b4-4587-8d88-0c86620d943e') },
        applicantDecision,
        applicationDecision,
        criteriaResult,
      },
      previousResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      expectedResult: true,
      description: 'current response and previous response have differences in the serviceStatus',
      buildBackgroundReport: report => ({ current: report, previous: report }),
    },
    {
      currentResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      previousResponse: { serviceStatus, applicantDecision: { ...applicantDecision, result: 'APPROVED_WITH_COND' }, applicationDecision, criteriaResult },
      expectedResult: true,
      description: 'current response and previous response have differences in the applicantDecision',
      buildBackgroundReport: report => ({ current: report, previous: report }),
    },
    {
      currentResponse: {
        serviceStatus,
        applicantDecision,
        applicationDecision: 'APPROVED_WITH_COND',
        criteriaResult,
      },
      previousResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      expectedResult: true,
      description: 'current response and previous response have differences in the applicationDecision',
      buildBackgroundReport: report => ({ current: report, previous: report }),
    },
    {
      currentResponse: {
        serviceStatus,
        applicantDecision,
        applicationDecision,
        criteriaResult: { ...updateCriteriaResult(criteriaResult, 305) },
      },
      previousResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      expectedResult: true,
      description: 'current response and previous response have differences in the criteria results',
      buildBackgroundReport: report => ({ current: report, previous: report }),
    },
    {
      currentResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      previousResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      expectedResult: true,
      description: 'current response and previous response have differences in the backgroundReport',
      buildBackgroundReport: report => ({ current: `${report} modified`, previous: report }),
    },
    {
      currentResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      previousResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      expectedResult: false,
      description: 'current response and previous response have the same backgroundReport',
      condition: 'not',
      buildBackgroundReport: report => ({ current: report, previous: report }),
    },
    {
      currentResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      previousResponse: { serviceStatus, applicantDecision, applicationDecision, criteriaResult },
      expectedResult: false,
      description: 'current response does not have a backgroundReport',
      condition: 'not',
      buildBackgroundReport: report => ({ previous: report }),
    },
  ];

  responses.forEach(r => {
    describe(`When the ${r.description}`, () => {
      it(`should ${r.condition || ''} store the screening response`, async () => {
        const { expectedResult, currentResponse, previousResponse, buildBackgroundReport } = r;
        const report = await getBackgroundReport(buildBackgroundReport);
        expect(
          shouldStoreScreeningResponse(ctx, {
            submissionRequestId: getUUID(),
            submissionResponse: {
              ...currentResponse,
              ...((report && { backgroundReport: report.current }) || {}),
            },
            lastStoredResponse: {
              ...previousResponse,
              ...((report && { backgroundReport: report.previous }) || {}),
            },
          }),
        ).to.equal(expectedResult);
      });
    });
  });
});
