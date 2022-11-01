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

const GroupProfileQuestion = ({ groupProfile, excludedOptions = [], handleQuestionsAnswered, disabled, columns }) => (
  <Field columns={columns}>
    <Dropdown
      id="dropdownLeaseType"
      wide
      disabled={disabled}
      selectedValue={groupProfile}
      label={t('IDENTIFY_LEASE_TYPE')}
      items={getQualificationQuestionsOptions('GroupProfile', excludedOptions)}
      onChange={({ id }) => handleQuestionsAnswered({ groupProfile: id })}
      required={true}
      testId="question2"
    />
  </Field>
);

GroupProfileQuestion.displayName = 'groupProfile';
export default GroupProfileQuestion;
