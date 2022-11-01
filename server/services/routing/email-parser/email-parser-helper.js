/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../../common/enums/DALTypes';
import loggerModule from '../../../../common/helpers/logger';
import { isObject } from '../../../../common/helpers/type-of.js';

const logger = loggerModule.child({ subType: 'email parser' });

const findQualificationQuestionOption = (types, option) => {
  if (!option) return '';

  const optionsToFind = Array.isArray(option) ? option : [option];

  const options = Object.keys(types);
  const answerQuestion = options.filter(key => optionsToFind.includes(key));
  if (!answerQuestion.length) {
    logger.warn({ options, key: option }, 'Could not find qualification question');
  }
  return answerQuestion;
};

const mapNumberOfBedroomsOption = numBedrooms => findQualificationQuestionOption(DALTypes.QualificationQuestions.BedroomOptions, numBedrooms);

const mapMoveInTimeOption = moveInTime => findQualificationQuestionOption(DALTypes.QualificationQuestions.MoveInTime, moveInTime);

const mapGroupProfileOption = groupProfile => findQualificationQuestionOption(DALTypes.QualificationQuestions.GroupProfile, groupProfile);

export const parseQualificationQuestions = questionsMap => {
  const numBedrooms = mapNumberOfBedroomsOption(questionsMap.get('numBedrooms'));
  const moveInTime = mapMoveInTimeOption(questionsMap.get('moveInDate'));
  const groupProfile = mapGroupProfileOption(questionsMap.get('groupProfile'));

  const qualificationQuestions = {};
  numBedrooms.length && Object.assign(qualificationQuestions, { numBedrooms });
  moveInTime.length && Object.assign(qualificationQuestions, { moveInTime: moveInTime[0] });
  groupProfile.length && Object.assign(qualificationQuestions, { groupProfile: groupProfile[0] });
  return qualificationQuestions;
};

export const getIlsEmailFromHeaders = ({ headers = {} } = {}) => {
  if (!headers.from) return '';

  if (isObject(headers.from)) {
    const [ilsEmail] = headers.from.value || [];
    return (ilsEmail && ilsEmail.address) || '';
  }

  const [, ilsEmail = ''] = (headers.from || '').match(/\.*\s*<([^>]*)/) || [];
  return ilsEmail;
};

export const replaceFromEmailWith = (baseInformation, email) => ({
  ...baseInformation,
  from: email,
  contactInfo: {
    ...baseInformation.contactInfo,
    email,
  },
});
