/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Field } from 'components';
import { observer } from 'mobx-react';
import NumberOfUnits from '../NumberOfUnits/NumberOfUnits';

const NumberOfUnitsQuestion = ({ field, columns, onChange, disabled }) => (
  <Field columns={columns}>
    <NumberOfUnits
      wide
      disabled={disabled}
      numberOfUnits={field.value}
      onBlur={field.markBlurredAndValidate}
      onChange={({ value }) => {
        field.setValue(value);
        onChange && onChange(value);
      }}
      required={true}
      id="numberOfUnitsQuestion"
      errorMessage={field.errorMessage}
    />
  </Field>
);

NumberOfUnitsQuestion.displayName = 'NumberOfUnitsQuestion';
export default observer(NumberOfUnitsQuestion);
