/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { parse, unparse } from 'node-uuid';

export const waitFor = timeout =>
  new Promise(resolve => {
    setTimeout(resolve, timeout);
  });

export const getObjectKeysAsArray = e =>
  Object.keys(e).reduce((acc, key) => {
    acc.push(e[key]);
    return acc;
  }, []);

// node-uuid is deprecated. uuid is the suggested module to use
// all the rest of the code use uuid/v4, but parse/unparse methods
// are not present in uuid that's why we still use node-uuid  here.
// This should be the only place where node-uuid is used.
export const isUuid = pretendUuid => {
  if (typeof pretendUuid !== 'string') {
    return false;
  }

  const bytes = parse(pretendUuid);
  const parsedUuid = unparse(bytes);

  return pretendUuid === parsedUuid;
};
