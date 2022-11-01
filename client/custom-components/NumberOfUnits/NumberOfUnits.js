/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { t } from 'i18next';
import { TextBox } from 'components';
import { TAB, isNavigationOrEntryKey } from '../../../common/helpers/keys';

const NumberOfUnits = ({ numberOfUnits, onChange, disabled, ...props }) => {
  const getParsedValue = input => {
    const parsedValue = parseInt(input, 10);
    return isNaN(parsedValue) ? null : parsedValue;
  };

  const handleOnKeyDown = e => {
    if (isNavigationOrEntryKey(e.keyCode) || e.keyCode === TAB) return;

    if (e.key.match(/[0-9]/)) return;

    e.preventDefault();
  };

  const handleOnChange = ({ value }) => onChange && onChange({ value: getParsedValue(value) });

  const handleOnPaste = e => e.preventDefault();

  return (
    <TextBox
      disabled={disabled}
      value={numberOfUnits}
      label={t('NUMBER_OF_UNITS')}
      onKeyDown={handleOnKeyDown}
      onChange={handleOnChange}
      onPaste={handleOnPaste}
      {...props}
    />
  );
};

NumberOfUnits.propTypes = {
  numberOfUnits: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
};

export default NumberOfUnits;
