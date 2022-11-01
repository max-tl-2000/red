/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { NUMBER_DIGIT_INCLUDE_X, NUMBER } from '../../../common/regex';

export const dateMask = { mask: '99/99/0000' };
export const money = { mask: '#,##0.00', options: { reverse: true } };
export const numeric = { mask: '0#' };

export const zipCode = { mask: '09999-9999' };
export const monthAndYear = { mask: '09/0000' };

export const ssn = {
  mask: '000-00-aaaa',
  options: {
    translation: {
      a: { pattern: NUMBER_DIGIT_INCLUDE_X },
      0: { pattern: NUMBER },
    },
  },
};
