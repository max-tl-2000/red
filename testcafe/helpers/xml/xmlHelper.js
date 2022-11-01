/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js';

export const parseXmlResult = (msg, explicitArray = true) => {
  const parser = new xml2js.Parser({ explicitArray, trim: true });
  return new Promise((resolve, reject) => {
    parser.parseString(msg, (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result);
    });
  });
};
