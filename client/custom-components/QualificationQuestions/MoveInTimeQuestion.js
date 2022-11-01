/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Field, Dropdown } from 'components';
import { t } from 'i18next';
import { getQualificationQuestionsOptions } from './questionUtils';

const MoveInTimeQuestion = ({ moveInTime, disabled, handleQuestionsAnswered, columns }) => (
  <Field columns={columns}>
    <Dropdown
      wide
      disabled={disabled}
      selectedValue={moveInTime}
      label={t('WHEN_DO_YOU_EXPECT_TO_RENT')}
      items={getQualificationQuestionsOptions('MoveInTime')}
      onChange={({ id }) => handleQuestionsAnswered({ moveInTime: id })}
      testId="question1"
      required={true}
      id="moveInTimeQuestion"
    />
  </Field>
);

MoveInTimeQuestion.displayName = 'moveInTime';
export default MoveInTimeQuestion;
