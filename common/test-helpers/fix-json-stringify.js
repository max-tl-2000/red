/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const stringify = JSON.stringify;

before(() => {
  JSON.stringify = obj => {
    const seen = [];

    return stringify(obj, (key, val) => {
      if (typeof val === 'object') {
        if (seen.indexOf(val) >= 0) {
          return;
        }
        seen.push(val);
      }
      return val; // eslint-disable-line
    });
  };
});

after(() => {
  JSON.stringify = stringify;
});
