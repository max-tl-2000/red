/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable max-classes-per-file */
import pick from 'lodash/pick';
import { getRelativePriceFeeDependencyErrorMsg } from '../dal/helpers/fees';
import { isObject } from '../../common/helpers/type-of';

export class BaseError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    Error.captureStackTrace(this, this.constructor.name);
  }
}

export class ContextualError extends BaseError {
  constructor(ctx) {
    const { message, ...properties } = ctx instanceof Object ? ctx : { message: ctx };
    super(message);
    Object.assign(this, properties);
  }
}

export class FeeRelativePriceError extends BaseError {
  constructor(feeName) {
    const message = getRelativePriceFeeDependencyErrorMsg(feeName);
    super(message);
  }
}

export class ServiceError extends BaseError {
  constructor(options) {
    if (options instanceof Object) {
      const { token, ...properties } = options;

      super(options.token);
      this.token = token;

      Object.assign(this, properties);
    } else {
      super(options);
      this.token = options;
    }
  }
}

// This is an error that indicates that an AMQ message
// should NOT be retried
export class NoRetryError extends BaseError {
  constructor(message) {
    super(message);
    this.processed = true;
  }
}

export class CommunicationTargetNotFoundError extends NoRetryError {}

/*
  500 Internal Server Error
  A generic error message, given when an unexpected condition was encountered and no more specific message is suitable.
*/
export class InternalServerError extends ServiceError {
  constructor(options) {
    super(options);
    this.status = 500;
  }
}

/*
  400 Bad request error
  The server cannot or will not process the request due to an apparent client error
*/
export class BadRequestError extends ServiceError {
  constructor(options) {
    super(options);
    this.status = 400;
  }
}

export class EntityTooLargeError extends ServiceError {
  constructor(options) {
    super(options);
    this.status = 413;
  }
}
export class AuthorizationDataError extends ServiceError {
  constructor(options) {
    super(options);
    this.status = 401;
  }
}
export class SheetImportError extends BaseError {
  constructor(options) {
    const message = isObject(options) ? options.message || options.errorMessage : options;
    super(message);

    if (isObject(options)) {
      const IMPORT_ERROR_FIELDS = ['sheetName', 'columnName', 'fieldValue', 'row', 'prerequisite', 'extraInfo', 'invalidCells'];
      Object.assign(this, pick(options, IMPORT_ERROR_FIELDS));
    }
    this.errorMessage = message;
  }
}

export const throwCustomError = (errorType, messages) => {
  const customError = new Error(errorType);
  customError.messages = messages;
  customError.rmsErrorType = errorType;
  throw customError;
};
