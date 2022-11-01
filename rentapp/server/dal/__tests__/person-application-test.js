/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { preparePersonApplicationWithSsn } from '../person-application-repo';

describe('preparePersonApplicationWithSsn', () => {
  describe('When the raw application data has an empty ssn or itin', () => {
    // For the case when an edition of the applicaton is done where an ssn was set before and now the user wants to set it empty.
    it('should return the person application raw with an null ssn', () => {
      const personApplicationRaw = { applicationData: { ssn: '' }, ssn: '{ENCRYPTED}:3hHnw+AbKRDxr20p:dEvbLUELAcNnqoo=' };
      const personApplication = preparePersonApplicationWithSsn(personApplicationRaw);
      expect(personApplication.ssn).toEqual(null);
    });

    it('should return the person application raw with an null itin', () => {
      const personApplicationRaw = { applicationData: { itin: '' }, itin: '{ENCRYPTED}:3hHnw+AbKRDxr20p:dEvbLUELAcNnqoo=' };
      const personApplication = preparePersonApplicationWithSsn(personApplicationRaw);
      expect(personApplication.itin).toEqual(null);
    });
  });

  describe('When the raw application data has an itin', () => {
    it('should return the person application raw with the new encrypted itin and no itin in the application Data', () => {
      const personApplicationRaw = { applicationData: { itin: '999-88-5555' }, itin: '' };
      const personApplication = preparePersonApplicationWithSsn(personApplicationRaw);
      expect(personApplication.itin).toMatch(/^{ENCRYPTED}:./);
      expect(personApplication.applicationData.itin).toEqual(undefined);
    });
  });

  describe('When the raw application data has an SSN', () => {
    it('should return the person application raw with the new encrypted ssn and no ssn in the application Data', () => {
      const personApplicationRaw = { applicationData: { ssn: '444-44-4444' }, itin: '' };
      const personApplication = preparePersonApplicationWithSsn(personApplicationRaw);
      expect(personApplication.ssn).toMatch(/^{ENCRYPTED}:./);
      expect(personApplication.applicationData.ssn).toEqual(undefined);
    });
  });
});
