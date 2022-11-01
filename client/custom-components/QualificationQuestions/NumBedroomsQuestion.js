/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Field, ButtonBar } from 'components';
import { t } from 'i18next';
import { cf } from './QualificationQuestions.scss';
import { getQualificationQuestionsOptions } from './questionUtils';

const NumBedroomsQuestion = ({ numBedrooms = [], handleQuestionsAnswered, disabled, readOnly }) => (
  <Field className={cf('bedrooms-field')}>
    <ButtonBar
      label={t('NUMBER_OF_BEDROOMS_QUESTION')}
      id="bedroomsBar"
      disabled={disabled}
      readOnly={readOnly}
      elementClassName={cf('buttonbar-item')}
      items={getQualificationQuestionsOptions('BedroomOptions')}
      selectedValue={numBedrooms}
      multiple
      required
      onChange={({ ids }) => handleQuestionsAnswered({ numBedrooms: ids })}
    />
  </Field>
);

NumBedroomsQuestion.displayName = 'numBedrooms';
export default NumBedroomsQuestion;
