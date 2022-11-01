/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import { when } from '../../../../common/test-helpers';
import { getScreeningRequestDataDiff } from '../fadv-screening-data-diff-helper';
import applicantData1 from './fixtures/applicant-data-1.json';
import applicantData2 from './fixtures/applicant-data-2.json';
import { applicantDataDiff } from './fixtures/fadv-test-data';

const { expect } = chai;
const emptyApplicantDataDiff = { diff: [] };

describe('FADV Helper get screening request application data diff', () => {
  when('there is no applicant data', () => {
    it('should return an empty diff of applicant data', () => {
      expect(getScreeningRequestDataDiff()).to.deep.equal(emptyApplicantDataDiff);
      expect(getScreeningRequestDataDiff({}, {})).to.deep.equal(emptyApplicantDataDiff);
    });
  });

  when('applicant data is the same', () => {
    it('should return an empty diff of applicant data', () => {
      expect(getScreeningRequestDataDiff(applicantData1, applicantData1)).to.deep.equal(emptyApplicantDataDiff);
    });
  });

  when('applicant data is different', () => {
    it('should return a diff object between applicant data', () => {
      expect(getScreeningRequestDataDiff(applicantData1, applicantData2)).to.deep.eq(applicantDataDiff);
    });
  });
});
