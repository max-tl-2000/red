/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import bcrypt from 'bcryptjs';

export function hash(value) {
  return new Promise((resolve, reject) => {
    bcrypt.hash(value, 8, (err, hashedValue) => {
      if (err) return reject(err);

      return resolve(hashedValue);
    });
  });
}

export function compare(value, hashedValue) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(value, hashedValue, (err, isMatching) => {
      if (err) return reject(err);

      return resolve(isMatching);
    });
  });
}
