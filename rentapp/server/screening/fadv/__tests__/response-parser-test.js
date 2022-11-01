/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js-es6-promise';
import newId from 'uuid/v4';
import sortBy from 'lodash/sortBy';
import { read } from '../../../../../common/helpers/xfs';
import { fillHandlebarsTemplate } from '../../../../../common/helpers/handlebars-utils';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';
import { ScreeningVersion } from '../../../../../common/enums/screeningReportTypes.ts';
import { toMoment } from '../../../../../common/helpers/moment-utils';

const { mock } = require('test-helpers/mocker').default(jest);

describe('given FADV response scenarios using the Response parser', () => {
  const annApplicantId = newId();
  const bobApplicantId = newId();
  const timezone = 'America/Los_Angeles';

  mock('../../../dal/fadv-submission-repo', () => ({
    getSubmissionRequest: () => ({
      applicantData: {
        applicants: [
          {
            firstName: 'Ann',
            lastName: 'Smith',
            applicantId: annApplicantId,
          },
          {
            firstName: 'Bob',
            lastName: "O'Doole",
            applicantId: bobApplicantId,
          },
        ],
      },
    }),
  }));

  mock('../../../dal/applicant-report-request-tracking-repo.ts', () => ({
    getApplicantReportRequestsById: () => ({ timezone }),
  }));

  const responseParser = require('../screening-report-parser.ts'); // eslint-disable-line global-require
  const { handleParsedFADVResponse } = responseParser;

  const BASE_PATH = 'rentapp/server/screening/fadv/__integration__/fixtures/';

  const tenantId = newId();
  const ctx = { tenantId };

  const SCREENING_DECISION = {
    DENIED: 'DENIED',
    APPROVED_WITH_CONDITIONS: 'APPROVED WITH CONDITIONS',
    APPROVED: 'APPROVED',
  };

  const baseCustomRecords = {
    customRecords: {
      'User Defined 1': 'ABC123',
      'User Defined 2': '999999',
      'Unit Number': '951',
    },
  };

  const baseExpectedResult = {
    externalId: '6490560',
    TransactionNumber: '1001',
    ReportDate: '2011-04-08',
    MonthlyRent: 5000,
    ApplicantDecision: [
      {
        applicantId: annApplicantId,
        result: SCREENING_DECISION.DENIED,
      },
      {
        applicantId: bobApplicantId,
        result: SCREENING_DECISION.DENIED,
      },
    ],
    Status: 'Complete',
    tenantId,
    ApplicationDecision: 'DENIED',
    RequestID_Returned: '414926',
    serviceStatus: {},
  };

  const approvedWithConditionResult = {
    ...baseExpectedResult,
    ApplicationDecision: ScreeningDecision.APPROVED_WITH_COND,
    ApplicantDecision: [
      {
        applicantId: annApplicantId,
        result: SCREENING_DECISION.APPROVED_WITH_CONDITIONS,
      },
      {
        applicantId: bobApplicantId,
        result: SCREENING_DECISION.APPROVED_WITH_CONDITIONS,
      },
    ],
  };
  const serviceStatusResult = {
    [annApplicantId]: [
      { serviceName: 'Criminal', status: 'IN_PROCESS' },
      { serviceName: 'Collections', status: 'COMPLETE' },
      { serviceName: 'Credit', status: 'BLOCKED' },
    ],
    [bobApplicantId]: [
      { serviceName: 'Criminal', status: 'IN_PROCESS' },
      { serviceName: 'Collections', status: 'COMPLETE' },
      { serviceName: 'Credit', status: 'BLOCKED' },
    ],
  };

  const updatedAt = toMoment('10/17/2018 8:58:28 AM', { timezone });

  const serviceStatusResultV2 = {
    Criminal: { status: 'IN_PROCESS', updatedAt },
    Collections: { status: 'COMPLETE', updatedAt },
    Credit: { status: 'BLOCKED', updatedAt },
  };

  const baseCriteriaResult = {
    criteriaResult: {
      302: {
        passFail: 'P',
        criteriaDescription: 'Applicant has no VCAP records matched in the last 10 years.',
        criteriaId: '302',
        criteriaType: 'CM',
        override: 'None',
        applicantResults: {
          25332342: 'P',
        },
      },
      303: {
        passFail: 'P',
        criteriaDescription: 'Applicant has no serious misdemeanor records matched in the last 7 years.',
        criteriaId: '303',
        criteriaType: 'CM',
        override: 'None',
        applicantResults: {
          25334515: 'P',
          25332342: 'P',
          25332903: 'F',
          25323424: 'P',
        },
      },
      321: {
        passFail: 'P',
        criteriaDescription: 'Applicant has no felony drug records in the last 20 years.',
        criteriaId: '321',
        criteriaType: 'CM',
        override: 'None',
        applicantResults: {
          25334515: 'P',
        },
      },
    },
  };

  const screeningRequestId = newId();

  const readAndParseXml = async (fileName, version = ScreeningVersion.V1) => {
    const xmlString = await read(BASE_PATH.concat(fileName), {
      encoding: 'utf8',
    });
    const annApplicantIdentifierStr = `${tenantId}:${annApplicantId}`;
    const bobApplicantIdentifierStr = `${tenantId}:${bobApplicantId}`;

    const applicantsIdentifiers = [annApplicantIdentifierStr, bobApplicantIdentifierStr];
    const filledResponseTemplate = await fillHandlebarsTemplate(xmlString, {
      applicantsIdentifiers,
      screeningRequestId,
      version,
    });
    return await xml2js(filledResponseTemplate);
  };

  const evaluateScenario = async (scenarioFile, expectedResult, hasBackgroundReport) => {
    const parsedXml = await readAndParseXml(scenarioFile);
    if (hasBackgroundReport) {
      expectedResult.BackgroundReport = parsedXml.ApplicantScreening.Response[0].BackgroundReport[0];
    }
    const result = await handleParsedFADVResponse(ctx, parsedXml);
    const expectedWithoutBR = { ...expectedResult };
    delete expectedWithoutBR.BackgroundReport;
    const resultWithoutBR = { ...result };
    delete resultWithoutBR.BackgroundReport;
    expect(resultWithoutBR).toEqual(expectedWithoutBR);
    expect(result.BackgroundReport).toEqual(expectedResult.BackgroundReport);
  };

  it('Correctly parses the nominal scenario', async () => {
    const expectedResult = {
      ...baseExpectedResult,
      customRecords: {
        screeningRequestId,
      },
      ...baseCriteriaResult,
      recommendations: [],
    };
    await evaluateScenario('scenario-ann-bob-denied.xml', expectedResult, true);
  });

  it('Correctly parses the nominal scenario without CustomRecords attribute', async () => {
    const expectedResult = { ...baseExpectedResult };
    await evaluateScenario('scenario-ann-bob-denied-no-custom-records.xml', expectedResult, true);
  });

  it('Correctly parses a scenario in which applicant names have a hyphen', async () => {
    const expectedResult = {
      ...baseExpectedResult,
      ...baseCustomRecords,
    };

    await evaluateScenario('scenario-jean-lucpicard-bob-denied.xml', expectedResult, true);
  });

  it('Correctly parses the nominal scenario with an empty Background report', async () => {
    const expectedResult = {
      ...baseExpectedResult,
      BackgroundReport: '',
      ...baseCustomRecords,
    };

    await evaluateScenario('scenario-ann-bob-empty-background-report.xml', expectedResult, false);
  });

  it('Correctly parses the nominal scenario without the Background report attribute', async () => {
    const expectedResult = {
      ...baseExpectedResult,
      ...baseCustomRecords,
    };

    await evaluateScenario('scenario-ann-bob-no-background-report.xml', expectedResult, false);
  });

  it('Correctly parses the nominal scenario with the CustomRecordsExtended attribute', async () => {
    const expectedResult = {
      ...baseExpectedResult,
      customRecords: {
        screeningRequestId,
      },
      ...baseCriteriaResult,
      recommendations: [],
    };
    await evaluateScenario('scenario-ann-bob-denied-with-custom-records-extended.xml', expectedResult, true);
  });

  it('Correctly parses the nominal scenario with some override present', async () => {
    const expectedResult = {
      ...approvedWithConditionResult,
      customRecords: {
        screeningRequestId,
      },
      ...baseCriteriaResult,
      recommendations: [
        {
          id: '505',
          text: 'Applicant must pay an additional deposit',
        },
        {
          id: '941',
          text: 'Applicant must provide proof of payment of tax lien',
        },
        {
          id: '1455',
          text: 'Applicant must provide landlord with proper notice',
        },
      ],
    };
    await evaluateScenario('scenario-ann-bob-approved-with-conditions-and-overrides.xml', expectedResult, true);
  });

  it('Correctly parses the nominal scenario with safe scan text present', async () => {
    const expectedResult = {
      ...approvedWithConditionResult,
      customRecords: {
        screeningRequestId,
      },
      ...baseCriteriaResult,
      recommendations: [
        {
          id: '1455',
          text: 'Applicant must provide landlord with proper notice',
        },
        {
          id: 'reva-safescan',
          text:
            'Security statement present on report,Possible fraud associated with this credit file. Please have the applicant contact First Advantage at 800.487.3246 or 972.952.1480',
        },
      ],
    };
    await evaluateScenario('scenario-ann-bob-approved-with-conditions-and-safe-scan.xml', expectedResult, true);
  });

  describe('And the ApplicationDecision value should be parseed into our reva value', () => {
    const replaceApplicationDecision = (baseResponse, applicationDecision) => {
      const { ApplicantScreening } = baseResponse;
      const { Response } = ApplicantScreening;
      return {
        ...baseResponse,
        ApplicantScreening: {
          ...ApplicantScreening,
          Response: [
            {
              ...Response[0],
              ApplicationDecision: [applicationDecision],
            },
          ],
        },
      };
    };

    [
      { fadvValue: 'APPRVD W/COND', revaValue: ScreeningDecision.APPROVED_WITH_COND },
      { fadvValue: 'FURTHER REVIEW', revaValue: ScreeningDecision.FURTHER_REVIEW },
      { fadvValue: 'Dispute Blocked', revaValue: ScreeningDecision.DISPUTED },
      { fadvValue: 'Guarantor Required', revaValue: 'Guarantor Required' }, // To ensure that not mapped values are stored as they arrive from fadv
    ].forEach(({ fadvValue, revaValue }) => {
      it(`should parse the incoming ApplicationDecision '${fadvValue}' into '${revaValue}' reva value`, async () => {
        const baseResponse = await readAndParseXml('scenario-ann-bob-approved-with-conditions-and-overrides.xml');
        const fadvResponse = replaceApplicationDecision(baseResponse, fadvValue);
        const parsedFadvResponse = await handleParsedFADVResponse(ctx, fadvResponse);
        expect(parsedFadvResponse.ApplicationDecision).toEqual(revaValue);
      });
    });
  });

  describe('And it has ServiceStatus', () => {
    it('should parse the services status into a reva value', async () => {
      const response = await readAndParseXml('scenario-ann-bob-incomplete.xml');
      const parsedFadvResponse = await handleParsedFADVResponse(ctx, response);
      const annServiceStatus = serviceStatusResult[annApplicantId];
      const bobServiceStatus = serviceStatusResult[bobApplicantId];
      serviceStatusResult[annApplicantId] = sortBy(annServiceStatus, 'serviceName');
      serviceStatusResult[bobApplicantId] = sortBy(bobServiceStatus, 'serviceName');
      expect(parsedFadvResponse.serviceStatus).toEqual(serviceStatusResult);
    });

    describe('And it comes from the version 2', () => {
      it('should parse the services status into a reva value', async () => {
        const response = await readAndParseXml('scenario-ann-bob-incomplete-v2.xml', ScreeningVersion.V2);
        const parsedFadvResponse = await handleParsedFADVResponse(ctx, response);
        expect(parsedFadvResponse.serviceStatus).toEqual(serviceStatusResultV2);
      });
    });
  });
});
