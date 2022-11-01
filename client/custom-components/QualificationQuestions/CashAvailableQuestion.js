/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Field, SelectionGroup, Typography } from 'components';
import { t } from 'i18next';
import { cf } from './QualificationQuestions.scss';
import { getQualificationQuestionsOptions } from './questionUtils';

const { SubHeader, Caption } = Typography;

const CashAvailableQuestion = ({ cashAvailable, disabled, handleQuestionsAnswered }) => (
  <Field>
    <SubHeader className={cf('subheader')}>{`${t('MONTHLY_INCOME_QUESTION')} *`}</SubHeader>
    <Caption>{t('MONTHLY_INCOME_QUESTION_SUBTITLE')}</Caption>
    <SelectionGroup
      className={cf('cashAvailable')}
      required
      readOnly={disabled}
      items={getQualificationQuestionsOptions('SufficientIncome')}
      selectedValue={cashAvailable}
      onChange={({ id }) => handleQuestionsAnswered({ cashAvailable: id })}
      id="incomeQuestion"
    />
  </Field>
);

CashAvailableQuestion.displayName = 'cashAvailable';
export default CashAvailableQuestion;
