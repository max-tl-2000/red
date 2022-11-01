/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DATE_US_FORMAT } from '../../date-constants';
import { toMoment, now } from '../moment-utils';

export const isValidDOB = field => {
  const dob = toMoment(field.value, { parseFormat: DATE_US_FORMAT });
  if (!dob.isValid()) {
    return { error: t('INVALID_DATE_FORMAT', { format: DATE_US_FORMAT }) };
  }

  const minYear = 1900;
  const minAge = 18;

  const minDOB = now().startOf('day').subtract(minAge, 'year');

  if (dob.year() < minYear) {
    // TODO: Check if we just need a different message here
    return {
      error: t('INVALID_DATE_RANGE', {
        min: minYear,
        max: minDOB.format(DATE_US_FORMAT),
      }),
    };
  }

  if (dob.isAfter(minDOB)) {
    return { error: t('YOU_MIGHT_BE_MIN_AGE_OR_OLDER', { minAge }) };
  }

  return true; // valid
};
