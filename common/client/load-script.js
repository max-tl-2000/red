/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { document as doc } from '../helpers/globals';

export const loadScript = (resource, { async } = {}) => {
  const script = doc.createElement('script');

  return new Promise((resolve, reject) => {
    script.src = resource;
    script.async = !!async;
    script.onload = () => resolve({});

    script.onerror = err => {
      console.error(`resource load error: ${resource}`, err);
      const error = new Error(`resource load error: ${resource}`);
      reject(error);
    };

    doc.body.appendChild(script);
  });
};
