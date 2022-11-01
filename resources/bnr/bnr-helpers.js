/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';

// helper method for commands that need parameters wrapped
// in single quotes like `shell-exec`
export const wrapInQuotes = arr => arr.map(entry => `'${entry}'`).join(' ');

// convert an array of values to an array of --parameter=value1, --parameter=value2, etc
export const toMultiParams = (arr, parameter, wrapValuesInQuotes) =>
  arr
    .map(entry => {
      const quoteMark = wrapValuesInQuotes ? "'" : '';
      return `--${parameter}=${quoteMark}${entry}${quoteMark}`;
    })
    .join(' ');

// join paths with the path.delimiter
export const joinPaths = paths => paths.map(entry => path.resolve(entry)).join(path.delimiter);

export const getShellExecCommand = (commands, options = { bail: true }) => {
  const params = [];
  options.bail && params.push('--bail');
  options.sortOutput && params.push('--sortOutput');
  options.dashboard && params.push('--dashboard');

  return `shell-exec ${params.join(' ')} ${wrapInQuotes(commands)}`;
};

export const moduleNotIncludedInSet = (excluded, module) => {
  if (!Array.isArray(excluded)) {
    excluded = [excluded];
  }
  return !excluded.includes(module);
};
