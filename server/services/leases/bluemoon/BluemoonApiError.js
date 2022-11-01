/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { BaseError } from '../../../common/errors';

class BluemoonApiError extends BaseError {
  constructor(ctx, message, requestOptions, responseTxt, error) {
    super({ ctx, message, requestOptions, responseTxt, error });
  }
}

export default BluemoonApiError;
