/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { toMoment, now } from './moment-utils';
import { UTC_TIMEZONE } from '../date-constants';

export const isInactiveProgram = endDate => {
  const endDateMoment = endDate && toMoment(endDate, { timezone: UTC_TIMEZONE });
  if (!endDateMoment || now({ timezone: UTC_TIMEZONE }).startOf('day').isBefore(endDateMoment)) {
    return false;
  }
  return true;
};
