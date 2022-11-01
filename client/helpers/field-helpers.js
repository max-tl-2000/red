/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import TextBox from 'components/TextBox/TextBox';
import ChipTextBox from 'components/ChipTextBox/ChipTextBox';
import MoneyTextBox from 'components/MoneyTextBox/MoneyTextBox';
import Dropdown from 'components/Dropdown/Dropdown';

export const getMoneyTextBox = (field, label, textProps, dataId = '') => (
  <MoneyTextBox
    value={field.value}
    label={label}
    onBlur={() => field.waitForBlur && field.markBlurredAndValidate()}
    errorMessage={field.errorMessage}
    onChange={({ value }) => field.setValue(value)}
    required={field.required}
    data-id={dataId}
    wide
    {...textProps}
  />
);

export const getTextBox = (
  field,
  label,
  {
    className,
    optional,
    placeholder,
    mask,
    id,
    type = 'text',
    textAffordance = '',
    disabled,
    forceSentenceCaseOnError,
    forceLowerCase,
    onBlur,
    onChange,
    autoComplete,
    dataId,
  } = {},
) => (
  <TextBox
    value={field.value}
    id={id}
    dataId={dataId}
    onBlur={() => {
      field.waitForBlur && field.markBlurredAndValidate();
      onBlur && onBlur();
    }}
    errorMessage={field.errorMessage}
    onChange={({ value }) => (onChange ? onChange(value) : field.setValue(value))}
    placeholder={placeholder}
    label={label}
    optional={optional}
    required={field.required}
    className={className}
    forceLowerCase={forceLowerCase}
    forceSentenceCaseOnError={forceSentenceCaseOnError}
    wide
    type={type}
    showClear
    mask={mask}
    disabled={disabled}
    textAffordance={textAffordance}
    autoComplete={autoComplete}
  />
);

export const getChipTextBox = (field, label, { placeholder, validator, maxNumItems, disabled, onChange, onBlur, forceLowerCase } = {}) => (
  <ChipTextBox
    value={field.value}
    onChange={onChange || (({ value }) => field.setValue(value))}
    validator={validator}
    wide
    forceLowerCase={forceLowerCase}
    maxNumItems={maxNumItems}
    label={label}
    placeholder={placeholder}
    disabled={disabled}
    onBlur={() => {
      field.waitForBlur && field.markBlurredAndValidate();
      onBlur && onBlur();
    }}
    errorMessage={field.errorMessage}
  />
);

export const getDropdown = (field, label, { items, optional, ...rest } = {}) => (
  <Dropdown
    items={items}
    selectedValue={field.value}
    optional={optional}
    required={field.required}
    errorMessage={field.errorMessage}
    onChange={({ id }) => field.setValue(id)}
    label={label}
    filterable
    wide
    {...rest}
  />
);
