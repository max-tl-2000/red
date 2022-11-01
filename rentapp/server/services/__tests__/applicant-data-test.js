/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { now } from '../../../../common/helpers/moment-utils';
import { calculateApplicantDataTimestamps } from '../applicant-data';
import { getApplicantDataDiff } from '../../helpers/applicant-data-diff-helper';

describe('Given a person application', () => {
  const _now = now();
  const applicationData = { email: 'email@reva.tech', phone: '15555555555', lastName: 'Lastname', firstName: 'Firstname' };
  const applicationDataTimestamps = { email: _now, phone: _now, lastName: _now, firstName: _now };
  const applicantData = {
    personId: getUUID(),
    propertyId: getUUID(),
    applicationData,
    applicationDataTimestamps,
    startDate: now().toDate(),
  };

  it('should not calculate a new set of timestamp diffs if the application data has not changed', () => {
    const calculatedApplicantDataTimestamps = calculateApplicantDataTimestamps(applicantData, {});
    expect(calculatedApplicantDataTimestamps).to.deep.equal(applicantData.applicationDataTimestamps);
  });

  it('should calculate new set of timestamp diffs for the application data that changed', () => {
    const newApplicationData = { email: 'email@reva.tech', phone: '15555555555', lastName: 'John', firstName: 'Doe' };
    const newApplicantData = { ...applicantData, applicationData: newApplicationData };
    const applicationDataDiff = getApplicantDataDiff(applicantData, newApplicantData);

    const calculatedApplicantDataTimestamps = calculateApplicantDataTimestamps(applicantData, applicationDataDiff);
    expect(calculatedApplicantDataTimestamps).to.not.deep.equal(applicantData.applicationDataTimestamps);
    expect(calculatedApplicantDataTimestamps.firstName).to.equal(calculatedApplicantDataTimestamps.lastName);
    expect(calculatedApplicantDataTimestamps.email).to.equal(calculatedApplicantDataTimestamps.phone);
  });
});
