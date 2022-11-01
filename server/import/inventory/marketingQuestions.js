/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { DALTypes } from '../../../common/enums/DALTypes';
import { validate, Validation } from './util';
import { saveMarketingQuestion } from '../../dal/marketingQuestionsRepo';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displaySectionQuestion',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayPrimaryQuestion',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayPrimaryQuestionDescription',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayFollowupQuestion',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inputTypeForFollowupQuestion',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'enumValues',
    validation: [Validation.EXISTS_IN],
    validValues: DALTypes.InputTypeForFollowupQuestion,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'displayOrder',
    validation: [Validation.NUMERIC],
  },
];

const validateQuestionLevel = ({ displayPrimaryQuestion, displayFollowupQuestion }) => {
  if (!displayPrimaryQuestion && !displayFollowupQuestion) {
    return [
      {
        name: 'displayPrimaryQuestion',
        message: 'Every item should have at least one level of question',
      },
    ];
  }

  return [];
};

const customValidations = (ctx, question) => {
  const validations = [];
  return validations.concat(validateQuestionLevel(question));
};

const saveMarketingQuestionData = async (ctx, question) =>
  await saveMarketingQuestion(ctx, {
    ...omit(question, ['inactiveFlag']),
    enumValues: question.enumValues || [],
    inactive: !!question.inactiveFlag,
    displayOrder: question.displayOrder || 0,
  });

export const importMarketingQuestions = async (ctx, questions) => {
  const invalidFields = await validate(
    questions,
    {
      requiredFields: REQUIRED_FIELDS,
      async onValidEntity(question) {
        await saveMarketingQuestionData(ctx, question);
      },
      customCheck(question) {
        return customValidations(ctx, question);
      },
    },
    ctx,
    spreadsheet.MarketingQuestions.columns,
  );

  return {
    invalidFields,
  };
};
