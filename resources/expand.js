/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { difference, union } from 'lodash'; // eslint-disable-line red/no-lodash
import { glob } from '../common/helpers/xfs';

const globExclude = async pattern => {
  const exclude = pattern.indexOf('!') === 0;
  if (exclude) {
    pattern = pattern.slice(1);
  }

  return {
    result: await glob(pattern),
    exclude,
  };
};

export const expand = async ({ patterns }) => {
  if (typeof patterns === 'string') {
    patterns = [patterns];
  }
  const results = await Promise.all(
    patterns.reduce((acc, p) => {
      if (p) {
        acc.push(globExclude(p));
      }
      return acc;
    }, []),
  );

  const matches = results.reduce((acc, { result, exclude }) => {
    if (exclude) {
      acc = difference(acc, result);
    } else {
      acc = union(acc, result);
    }

    return acc;
  }, []);

  return matches.sort();
};
