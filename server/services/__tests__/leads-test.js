/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import omit from 'lodash/omit';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getValidQuestionsAndAnswers } from '../leads';

describe('services/leads', () => {
  describe('when the input qualification questions has invalid answers', () => {
    const bedroomsOptionsLiterals = Object.keys(DALTypes.QualificationQuestions.BedroomOptions).reduce((acc, key) => ({ ...acc, [key]: key }), {});

    const baseQualificationQuestions = {
      numBedrooms: [bedroomsOptionsLiterals.ONE_BED],
      groupProfile: DALTypes.QualificationQuestions.GroupProfile.EMPLOYEE,
      moveInTime: DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS,
      cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
    };

    [
      {
        input: baseQualificationQuestions,
        output: baseQualificationQuestions,
      },
      {
        input: {
          ...baseQualificationQuestions,
          numBedrooms: [bedroomsOptionsLiterals.ONE_BED, bedroomsOptionsLiterals.FOUR_PLUS_BEDS, 'FOUR_BEDS'],
        },
        output: {
          ...baseQualificationQuestions,
          numBedrooms: [bedroomsOptionsLiterals.ONE_BED, bedroomsOptionsLiterals.FOUR_PLUS_BEDS],
        },
      },
      {
        input: {
          ...baseQualificationQuestions,
          numBedrooms: ['FOUR_BEDS'],
        },
        output: omit(baseQualificationQuestions, ['numBedrooms']),
      },
      {
        input: {
          ...baseQualificationQuestions,
          groupProfile: 'UNKOWN_VALUE',
        },
        output: omit(baseQualificationQuestions, ['groupProfile']),
      },
      {
        input: {
          ...baseQualificationQuestions,
          newQuestion: 'UNKOWN', // the current implementation only validate known questions
        },
        output: {
          ...baseQualificationQuestions,
          newQuestion: 'UNKOWN',
        },
      },
    ].forEach(({ input, output }) => {
      it('should return only the valid questions with valid answers', () => {
        const validQuestions = getValidQuestionsAndAnswers({ tenantId: getUUID() }, input);
        expect(validQuestions).toEqual(output);
      });
    });
  });
});
