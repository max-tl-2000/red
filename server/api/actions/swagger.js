/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fs from 'fs';

export default function swagger(req) {
  const swaggerPath = path.join(__dirname, '..', 'swagger.json');

  return new Promise((resolve, reject) => {
    fs.readFile(swaggerPath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      }

      const obj = JSON.parse(data);
      obj.host = req.hostname;
      resolve(obj);
    });
  });
}
