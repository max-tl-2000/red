/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// TODO: should not be accessing leasing server from common
import { BadRequestError } from '../../server/common/errors';
import logger from './logger';
import { assert } from '../assert';
import nullish from './nullish';

export const badRequestErrorIfNotAvailable = errorMessagesByProperties =>
  errorMessagesByProperties.forEach(errorMessageByProperty => {
    if (nullish(errorMessageByProperty.property)) throw new BadRequestError(errorMessageByProperty.message);
  });

const isUndefined = val => typeof val === 'undefined' || val === null;

export const warnIfUndefined = (key, val) => {
  if (isUndefined(val)) logger.warn(`${key} was expected to be defined`);
};

export const hasUndefinedValues = obj => Object.entries(obj).some(([_key, val]) => isUndefined(val));

export const errorIfHasUndefinedValues = obj => Object.entries(obj).some(([key, val]) => true && assert(val, `${key} must be defined`));
