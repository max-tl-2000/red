/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { obscureUrl } from '../../common/helpers/logger-utils';

export const verboseLogCtx = (req, includeBody = false) => {
  const headersWithoutAuth = omit(req.headers, 'authorization');
  const obscuredUrl = req.url ? obscureUrl(req.url) : undefined;
  const reqRest = pick(req, 'reqId', 'method', 'params', 'query', 'protocol', 'path');
  const maybeBody = includeBody ? req.body : undefined;
  const newCtx = {
    ...reqRest,
    body: maybeBody,
    url: obscuredUrl,
    headers: headersWithoutAuth,
    secretHeaders: req.headers,
  };
  return newCtx;
};
