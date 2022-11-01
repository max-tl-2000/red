/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import { expect } from 'chai';
import { getApplicantDataDiff } from '../../helpers/applicant-data-diff-helper';

describe('helper/applicant-data-diff-helper', () => {
  let applicantData;
  const defaultApplicationDataAddress = {
    locality: {
      city: 'EXAMPLE CITY',
      zip5: '95391',
      state: 'CA',
    },
    normalized: {
      city: 'EXAMPLE CITY',
      line1: '257 S EXAMPLE ST',
      state: 'CA',
      address: '257 S EXAMPLE ST',
      postalCode: '95391-3009',
      unparsedAddress: '257 S EXAMPLE ST EXAMPLE CITY CA 95391-3009',
    },
    enteredByUser: {
      city: 'Example City',
      line1: '257 South Example Street',
      line2: '',
      state: 'CA',
      address: '257 South Example Street',
      postalCode: '95391',
      unparsedAddress: '257 South Example Street Example City CA 95391',
    },
  };
  const defaultApplicationData = {
    email: 'email@reva.tech',
    phone: '15555555555',
    lastName: 'Lastname',
    firstName: 'Firstname',
    address: defaultApplicationDataAddress,
  };

  beforeEach(() => {
    applicantData = {
      applicationData: defaultApplicationData,
    };
  });

  describe('when there is only one set of applicant data', () => {
    it('should return applicationDataDiff equal to application data in the available set of applicant data', () => {
      const applicationDataDiff = getApplicantDataDiff(applicantData);
      expect(applicationDataDiff).to.deep.equal(defaultApplicationData);
    });
  });

  describe('when there are two sets of applicant data', () => {
    it('should return an empty applicationDataDiff if both sets of applicant data is the same', () => {
      const applicationDataDiff = getApplicantDataDiff(applicantData, applicantData);
      expect(applicationDataDiff).to.deep.equal({});
    });

    it('should return an applicationDataDiff if the sets of applicant data are different', () => {
      const updatedAddressLine = {
        normalized: {
          ...defaultApplicationDataAddress.normalized,
          line1: '157 N EXAMPLE ST',
        },
        enteredByUser: {
          ...defaultApplicationDataAddress.enteredByUser,
          line1: '157 North Example Street',
        },
      };

      const updatedAddress = {
        ...defaultApplicationDataAddress,
        ...updatedAddressLine,
      };

      const updatedApplicationData = {
        lastName: 'Smith',
        firstName: 'John',
        socSecNumber: '123-1234-XXXX',
        address: updatedAddress,
      };

      const updatedApplicantData = {
        applicationData: { ...omit(defaultApplicationData, 'email'), ...updatedApplicationData },
      };

      const expectedDataDiff = {
        address: updatedApplicationData.address,
        firstName: updatedApplicationData.firstName,
        lastName: updatedApplicationData.lastName,
        socSecNumber: updatedApplicationData.socSecNumber,
        email: 'REMOVED',
      };

      const applicationDataDiff = getApplicantDataDiff(applicantData, updatedApplicantData);
      expect(isEmpty(applicationDataDiff)).to.not.be.true;
      expect(applicationDataDiff).to.deep.equal(expectedDataDiff);
    });
  });
});
