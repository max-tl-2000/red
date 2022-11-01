/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// prefix each key in an object hash with data-
// so it can be assigned as props to a React component
export const dataProps = (hash = {}) =>
  Object.keys(hash).reduce((seq, key) => {
    seq[`data-${key}`] = hash[key];
    return seq;
  }, {});
