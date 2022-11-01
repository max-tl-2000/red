/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../../server/common/errors';
import nullish from '../../../common/helpers/nullish';

export const checkFields = (req, obj = {}, fields = []) => {
  fields.forEach(field => {
    if (nullish(obj[field])) {
      req?.log?.error?.({ ctx: req }, `Missing required params: ${field}`);
      throw new ServiceError({ token: `MISSING_REQUIRED_PARAMETER: ${field}`, status: 400 });
    }
  });
};
