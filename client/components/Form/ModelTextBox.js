/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer } from 'mobx-react';
import TextBox from '../TextBox/TextBox';
import MoneyTextBox from '../MoneyTextBox/MoneyTextBox';

const ModelTextBox = observer(({ field, label, className, mask = '', type = 'text', textAffordance, ...rest }) => (
  <TextBox
    label={label}
    type={type}
    value={field.value}
    showClear
    required={rest.required || field.required}
    errorMessage={field.errorMessage}
    onChange={({ value }) => field.setValue(value)}
    onBlur={() => field.waitForBlur && field.markBlurredAndValidate()}
    className={className}
    mask={mask}
    wide
    textAffordance={textAffordance}
    {...rest}
  />
));

ModelTextBox.displayName = 'ModelTextBox';

export const ModelMoneyTextBox = observer(({ field, ...rest }) => (
  <MoneyTextBox
    value={field.value}
    required={rest.required || field.required}
    errorMessage={field.errorMessage}
    onChange={({ value }) => field.setValue(value)}
    onBlur={() => field.waitForBlur && field.markBlurredAndValidate()}
    wide
    {...rest}
  />
));

ModelMoneyTextBox.displayName = 'ModelMoneyTextBox';

export default ModelTextBox;
