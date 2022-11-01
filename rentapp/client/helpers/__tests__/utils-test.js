/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLastNameAndMiddlename, getApplicantName } from '../../../../common/helpers/applicants-utils.js';

const assertFullName = (result, { firstName = 'Ana', middleName, lastName = 'Tello' }) => {
  if (result.firstName) {
    expect(result.firstName).toEqual(firstName);
  }

  expect(result.middleName).toEqual(middleName);
  expect(result.lastName).toEqual(lastName);
};

describe('When the fisrtName, preffix and suffix have been extracted', () => {
  describe('if there is a middleName and two lastNames the getLastNameAndMiddlename', () => {
    it('should return the complete last name and middleName', () => {
      const partialLastName = 'Flores';
      const nameArray = ['Maria', 'Tello'];

      const result = getLastNameAndMiddlename(nameArray, partialLastName);

      assertFullName(result, { middleName: 'Maria', lastName: 'Tello Flores' });
    });
  });

  describe('if there is a middleName and one lastName the getLastNameAndMiddlename', () => {
    it('should return the complete last name and middleName', () => {
      const partialLastName = 'Flores';
      const nameArray = ['Maria'];

      const result = getLastNameAndMiddlename(nameArray, partialLastName);

      assertFullName(result, { middleName: 'Maria', lastName: 'Flores' });
    });
  });

  describe('if there is no name passed the getLastNameAndMiddlename', () => {
    it('should return empty middlename', () => {
      const partialLastName = 'Flores';

      const result = getLastNameAndMiddlename(null, partialLastName);

      assertFullName(result, { middleName: '', lastName: 'Flores' });
    });
  });

  describe('if there is  no partialLastName passed the getLastNameAndMiddlename', () => {
    it('should return empty lastName', () => {
      const nameArray = ['Maria'];

      const result = getLastNameAndMiddlename(nameArray);

      assertFullName(result, { middleName: 'Maria', lastName: '' });
    });
  });
});

describe('getApplicantName', () => {
  describe('When the fullName has a prefix, a firstName, MiddleName, two LastNames', () => {
    it('should return all the corresponding fields for each fullname word ommiting the preffix', () => {
      const fullname = 'Dr. Ana Maria Tello Flores';

      const result = getApplicantName(fullname);

      assertFullName(result, { middleName: 'Maria', lastName: 'Tello Flores' });
    });
  });

  describe('When the fullName a firstName, MiddleName, one LastName', () => {
    it('should return all the corresponding fields for each fullname word', () => {
      const fullname = 'Ana Maria Tello';

      const result = getApplicantName(fullname);

      assertFullName(result, { middleName: 'Maria' });
    });
  });

  describe('When the fullName a firstName, one LastName', () => {
    it('should return all the corresponding fields for each fullname word', () => {
      const fullname = 'Ana Tello';

      const result = getApplicantName(fullname);

      assertFullName(result, {});
    });
  });

  describe('When the fullName is not present', () => {
    it('should return all the corresponding fields as empty', () => {
      const fullname = null;

      const result = getApplicantName(fullname);

      assertFullName(result, { firstName: '', middleName: '', lastName: '' });
    });
  });
});
