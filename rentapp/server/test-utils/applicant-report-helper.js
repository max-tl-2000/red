/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import merge from 'lodash/merge';
import { mapSeries } from 'bluebird';
import { createTestBaseInfo } from './screening-test-helper';
import { createApplicantData } from '../dal/applicant-data-repo.ts';
import { now } from '../../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../../common/date-constants';
import { tenant } from '../../../server/testUtils/setupTestGlobalContext';
const ctx = { tenantId: tenant.id };

const baseApplicantSettings = {
  holdDeposit: 'hidden',
  petsSection: 'optional',
  creditReportRequiredFlag: true,
  criminalReportRequiredFlag: true,
  creditReportValidForPeriod: 30,
  criminalReportValidForPeriod: 30,
};
const baseApplicationData = {
  email: 'graphic.ward@gmail.com',
  phone: '19704818565',
  suffix: '',
  address: {
    locality: {
      city: 'SAN FRANCISCO',
      zip5: '94133',
      state: 'CA',
    },
    normalized: {
      city: 'SAN FRANCISCO',
      line1: '526 GREEN ST',
      line2: 'APT 4',
      state: 'CA',
      address: '526 GREEN ST APT 4',
      postalCode: '94133-3936',
      unparsedAddress: '526 GREEN ST APT 4 SAN FRANCISCO CA 94133-3936',
    },
    enteredByUser: {
      city: 'San Francisco',
      line1: '526 Green Street',
      line2: 'Unit 4',
      state: 'CA',
      address: '526 Green Street Unit 4',
      postalCode: '94133',
      unparsedAddress: '526 Green Street Unit 4 San Francisco CA 94133',
    },
  },
  lastName: 'Wardin',
  middleName: '',
  firstName: 'Deanna',
  addressLine: '',
  dateOfBirth: '1985-06-06',
  grossIncome: 72000,
  invitedToApply: '',
  grossIncomeMonthly: 6000,
  reportCopyRequested: true,
  grossIncomeFrequency: 'YEARLY',
  SSN: '555-55-5555',
  haveInternationalAddress: false,
};

const setUpInitialData = async ({ memberSettings, applicationSettings } = {}) =>
  await createTestBaseInfo({
    memberSettings: merge(
      {
        numberOfResidents: 1,
        numberOfGuarantors: 0,
      },
      memberSettings,
    ),
    propertySettings: {
      screening: {
        propertyName: 132661,
      },
      applicationSettings: merge(
        {
          corporate: {
            occupant: {
              ...baseApplicantSettings,
              creditReportRequiredFlag: false,
              criminalReportRequiredFlag: false,
              creditReportValidForPeriod: 0,
              criminalReportValidForPeriod: 0,
            },
          },
          traditional: {
            occupant: baseApplicantSettings,
            resident: baseApplicantSettings,
            guarantor: {
              ...baseApplicantSettings,
              criminalReportRequiredFlag: false,
              criminalReportValidForPeriod: 0,
            },
          },
        },
        applicationSettings,
      ),
    },
  });

export const createInitialApplicantData = async ({ haveInternationalAddress = false, numberOfApplicantDataRecords = 1, ...settings } = {}) => {
  const { residents, property } = await setUpInitialData(settings);
  const personId = residents[0].personId;
  const applicantsData = await mapSeries(
    Array(numberOfApplicantDataRecords).fill(),
    async _ =>
      await createApplicantData(ctx, {
        personId,
        propertyId: property.id,
        applicationData: {
          ...baseApplicationData,
          haveInternationalAddress,
          ...(haveInternationalAddress ? { address: baseApplicationData.address } : {}),
        },
        applicationDataDiff: {
          email: 'graphic.ward@gmail.com',
          SSN: '555-55-5555',
        },
        startDate: now({ timezone: LA_TIMEZONE }).toJSON(),
      }),
  );
  return { applicantDataIds: applicantsData.map(ad => ad.id), applicantsData, personId, propertyId: property.id };
};
