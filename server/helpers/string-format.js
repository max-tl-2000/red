/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export function stringFormat(string, params) {
  params = typeof params === 'object' ? params : Array.prototype.slice.call(arguments, 1); // eslint-disable-line

  return string.replace(/\{\{|\}\}|\{(\w+)\}/g, (m, n) => {
    if (m === '{{') {
      return '{';
    }
    if (m === '}}') {
      return '}';
    }
    return params[n];
  });
}
