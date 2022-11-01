/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';

export default function readFile(fPath) {
  return new Promise((resolve, reject) => {
    fs.readFile(
      fPath,
      {
        encoding: 'utf-8',
      },
      (err, content) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(content);
      },
    );
  });
}
