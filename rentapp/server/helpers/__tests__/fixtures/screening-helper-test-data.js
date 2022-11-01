/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { ScreeningDecision } from '../../../../../common/enums/applicationTypes';

export const personId = getUUID();
export const partialRawResponse = {
  ApplicantScreening: {
    LeaseTerms: [
      {
        MonthlyRent: '5000',
      },
    ],
    Response: [
      {
        ApplicationDecision: [ScreeningDecision.APPROVED],
      },
    ],
    Applicant: [
      {
        AS_Information: [
          {
            ApplicantIdentifier: ['6a2159d8-89b7-46ae-8058-04002c26fd27:ea954143-ed23-452f-948b-f84bcdf66ba3'],
            ApplicantType: ['Applicant'],
            Birthdate: ['1988-01-01'],
          },
        ],
        Customers: [
          {
            Customer: [
              {
                Identification: [
                  {
                    $: {
                      IDType: 'Applicant',
                    },
                    IDValue: [personId],
                  },
                ],
                Name: [
                  {
                    FirstName: ['Test'],
                    LastName: ['Resident'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    CustomRecordsExtended: [
      {
        Record: [
          {
            Name: ['XMLReport'],
            Value: [
              {
                AEROReport: [
                  {
                    Applicants: [
                      {
                        Applicant: [
                          {
                            $: {
                              applicantid: '2994',
                            },
                            Index: ['1'],
                            ApplicantID: ['2994'],
                            ApplicantName: ['Test resident '],
                            Recommendation: ['APPROVED WITH CONDITIONS'],
                            ApplicantType: ['APPLICANT'],
                          },
                        ],
                      },
                    ],
                    ApplicationInformation: [
                      {
                        SubmittedBy: ['Redisruptthree'],
                        ApplicantInformation: [
                          {
                            $: {
                              applicantid: '2994',
                            },
                            Applicant: [
                              {
                                ApplicantName: ['Test resident '],
                                ExternalId: ['6a2159d8-89b7-46ae-8058-04002c26fd27:ea954143-ed23-452f-948b-f84bcdf66ba3'],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const criteriaResults = {
  305: {
    override: '2025',
    passFail: 'P',
    criteriaId: '305',
    criteriaType: 'CM',
    applicantResults: {
      2994: 'P',
    },
    criteriaDescription: 'There are no exact name matches on the OFAC watch list.',
  },
  321: {
    override: 'None',
    passFail: 'P',
    criteriaId: '321',
    criteriaType: 'CM',
    applicantResults: {
      2994: 'P',
    },
    criteriaDescription: 'Applicant has no felony drug records in the last 70 years.',
  },
};
