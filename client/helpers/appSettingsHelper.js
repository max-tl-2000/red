/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isValidMoment } from '../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../common/date-constants';

export const TRUE_STRING = true.toString();
export const FALSE_STRING = false.toString();

export const encodeTextSetting = value => {
  if (!value) return '';
  return value.trim();
};

export const encodeBoolSetting = value => {
  if (!value || value.toString() !== TRUE_STRING) return FALSE_STRING;
  return TRUE_STRING;
};

export const encodeDateSetting = value => {
  if (!isValidMoment(value)) return null;
  return value.format(DATE_US_FORMAT);
};

export const encodeNumberSetting = value => {
  if (!value) return '';
  return value.trim();
};
