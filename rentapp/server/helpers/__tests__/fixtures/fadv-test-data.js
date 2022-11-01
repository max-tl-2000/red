/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const basePersonApplication = {
  dateOfBirth: '1965-10-19',
  email: 'testemail@reva.tech',
  socSecNumber: '555559999',
  grossIncomeMonthly: 4000.0,
  address: {
    enteredByUser: {
      line1: '404 NW Napp Street',
      line2: '',
      city: 'De Kalb',
      state: 'TX',
      postalCode: '75559',
      unparsedAddress: '404 NW Napp Street De Kalb TX 75559',
      address: '404 NW Napp Street',
    },
  },
};

const baseCustomRecords = {
  screeningRequestId: '527d4ca4-074d-ce67-223e-64c8e056f8b5',
  'User Defined 1': 'ABC123',
  'User Defined 2': '999999',
  'Unit Number': '951',
};

export const personId = 'e94b3393-0ff3-55a7-0aed-1b56e450dd66';
export const guarantorId = 'e94b3393-0ff3-55a7-0aed-1b56e450dd67';
export const applicantId = 'e9d46f19-3534-b417-47df-17f88ed32527';
export const guarantorApplicantId = '6f66d8c7-24fe-4e51-85e1-dce304de29a4';

export const tenantId = '5ac64195-fed8-49f9-ac15-5d2865aa2289';

export const personApplication = {
  lastName: 'Smith',
  middleName: 'Will',
  firstName: 'Dennis',
  ...basePersonApplication,
};

export const applicationWithGuarantor = {
  lastName: 'Smith',
  middleName: 'Matthew',
  firstName: 'Gary',
  ...basePersonApplication,
};

export const personApplicationWithMissingNotRequiredElements = {
  lastName: 'Smith',
  firstName: 'Dennis',
  ...basePersonApplication,
};

export const personApplicationWithMissingRequiredElements = basePersonApplication;

export const application = {
  applicants: [{ personId, type: 'Applicant', ...personApplication, applicantId }],
  tenantId,
  customRecords: baseCustomRecords,
};

export const applicationWithMissingNotRequiredElements = {
  applicants: [
    {
      personId,
      type: 'Applicant',
      ...personApplicationWithMissingNotRequiredElements,
      applicantId,
    },
  ],
  tenantId,
  customRecords: baseCustomRecords,
};

export const applicationWithMissingRequiredElements = {
  applicants: [
    {
      personId,
      type: 'Applicant',
      ...personApplicationWithMissingRequiredElements,
      applicantId,
    },
  ],
  tenantId,
};

export const applicationWithApplicantAndGuarantor = {
  applicants: [
    { personId, type: 'Applicant', ...personApplication, applicantId },
    {
      personId: guarantorId,
      type: 'Guarantor',
      ...applicationWithGuarantor,
      guarantorFor: `${tenantId}:${applicantId}`,
      applicantId: guarantorApplicantId,
    },
  ],
  tenantId,
  customRecords: baseCustomRecords,
};

export const applicationWithExistingScreeningRequest = {
  applicants: [{ personId, type: 'Applicant', ...personApplication, applicantId }],
  tenantId,
  customRecords: baseCustomRecords,
  externalId: '12345',
};

export const rent = {
  rent: 3000.0,
  deposit: 1000.0,
  leaseTermMonths: 12,
};

export const applicantDataDiff = {
  diff: [
    { object: 'H Street Northwest Miami OK 74354', action: 'Edit', prop: 'city', newVal: 'Miami', oldVal: 'Ashburn' },
    { object: 'H Street Northwest Miami OK 74354', action: 'Edit', prop: 'line1', newVal: 'H Street Northwest', oldVal: 'Ashburn Road' },
    { object: 'H Street Northwest Miami OK 74354', action: 'Edit', prop: 'state', newVal: 'OK', oldVal: 'VA' },
    { object: 'H Street Northwest Miami OK 74354', action: 'Edit', prop: 'address', newVal: 'H Street Northwest', oldVal: 'Ashburn Road' },
    { object: 'H Street Northwest Miami OK 74354', action: 'Edit', prop: 'postalCode', newVal: '74354', oldVal: '20147' },
    {
      object: 'H Street Northwest Miami OK 74354',
      action: 'Edit',
      prop: 'unparsedAddress',
      newVal: 'H Street Northwest Miami OK 74354',
      oldVal: 'Ashburn Road Ashburn VA 20147',
    },
    { object: 'Boba Fett', action: 'Edit', prop: 'socSecNumber', newVal: '321-21-XXXX', oldVal: '123-12-XXXX' },
    { object: 'applicantData', action: 'New', prop: 'applicants', newVal: 'Lando Calrissian', oldVal: '' },
    { object: 'rentData', action: 'Edit', prop: 'rent', newVal: 3000, oldVal: 2000 },
  ],
};
