/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { array2DataSource, bedroomsArray2DataSource } from '../../helpers/unitsUtils';

const getExcludedKeysFromQuestion = (question, excludedOptions = []) => {
  if (!excludedOptions.length) return [];

  return Object.entries(question)
    .filter(([_, value]) => excludedOptions.includes(value))
    .map(([key]) => key);
};

export const getQualificationQuestionsOptions = (questionKey, excludedOptions = []) => {
  const question = DALTypes.QualificationQuestions[questionKey];
  if (!question) return [];
  const values = questionKey === 'BedroomOptions' ? bedroomsArray2DataSource(question) : array2DataSource(Object.keys(question), question);
  const excludedOptionsFromQuestion = getExcludedKeysFromQuestion(question, excludedOptions);
  return values.filter(({ id }) => !excludedOptionsFromQuestion.includes(id));
};
