/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { deferred } from '../helpers/deferred';

const withCachedPromise = fn => {
  let p;
  return () => {
    if (!p) {
      p = fn();
    }

    return p;
  };
};

export const webpAlphaCapable = withCachedPromise(() => {
  const dfd = deferred();

  const image = new Image();

  image.onerror = () => {
    dfd.resolve(false);
  };

  image.onload = () => {
    dfd.resolve(image.width === 1);
  };

  // taken from modernizr (MIT), modified by reva. https://github.com/Modernizr/Modernizr/blob/master/feature-detects/img/webp-alpha.js
  image.src = 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==';

  return dfd;
});
