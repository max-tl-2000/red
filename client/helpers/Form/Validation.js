/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from '../../../common/helpers/trim';
import { DATE_US_FORMAT } from '../../../common/date-constants';
import { validateEmail, isPhoneValid, isNumberValid, isVehicleMakeYearValid, isLenghOfTextValid } from '../../../common/helpers/validations';
import { toMoment } from '../../../common/helpers/moment-utils';

const VALIDATION_TYPES = {
  REQUIRED: 'required',
  EMAIL: 'email',
  DATE: 'date',
  PHONE: 'phone',
  NUMBER: 'number',
  MAKE_YEAR: 'make_year',
  ALPHANUMERIC: 'alphanumeric',
};

const validationMethods = {
  [VALIDATION_TYPES.REQUIRED]: {
    fn: field => {
      const { value } = field;

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return !!trim(value);
    },
    errorToken: 'FIELD_REQUIRED',
  },
  [VALIDATION_TYPES.EMAIL]: {
    fn: ({ value }) => !trim(value) || validateEmail(value) !== 'INVALID_EMAIL',
    errorToken: 'INVALID_EMAIL',
  },
  [VALIDATION_TYPES.DATE]: {
    fn: ({ value }, args) => {
      const empty = !trim(value);

      if (empty) return true;

      const m = toMoment(value, { parseFormat: args.format, strict: true });
      const year = m.year();

      const validDate = m.isValid();

      if (validDate) {
        const validRange = year >= args.minYear && year <= args.maxYear;
        if (!validRange) {
          return { errorToken: 'INVALID_DATE_RANGE' };
        }
      }

      return validDate;
    },
    errorToken: 'INVALID_DATE',
    args: {
      format: DATE_US_FORMAT,
      minYear: 1900,
      maxYear: 2100,
    },
  },
  [VALIDATION_TYPES.PHONE]: {
    fn: ({ value }) => !trim(value) || isPhoneValid(value),
    errorToken: 'INVALID_PHONE',
  },
  [VALIDATION_TYPES.NUMBER]: {
    fn: ({ value }) => !trim(value) || isNumberValid(value),
    errorToken: 'INVALID_NUMBER',
  },
  [VALIDATION_TYPES.MAKE_YEAR]: {
    fn: ({ value }) => !trim(value) || isVehicleMakeYearValid(value),
    errorToken: 'INVALID_MAKE_YEAR',
  },
  [VALIDATION_TYPES.ALPHANUMERIC]: {
    fn: ({ value }, { limit }) => !trim(value) || isLenghOfTextValid(value, limit),
    errorToken: 'INVALID_TEXT',
  },
};

const validate = (field, type, validatorDescriptor = {}) => {
  const validator = validationMethods[type];

  if (!validator) {
    throw new Error('Unknown Validation');
  }

  const args = { ...validator.args, ...validatorDescriptor.args };
  const res = validator.fn(field, args);
  const formatError = validator.formatError || validatorDescriptor.formatError;

  let isValid;
  let errorToken;

  if (typeof res === 'boolean') {
    isValid = res;
  } else {
    isValid = !res.errorToken;
  }

  if (!isValid) {
    errorToken = formatError ? formatError(res.errorToken || validator.errorToken, args) : res.errorToken;
  }

  return {
    isValid,
    errorToken,
  };
};

export { VALIDATION_TYPES, validate };
