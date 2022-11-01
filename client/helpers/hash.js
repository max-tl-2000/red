/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import tryParse from 'helpers/try-parse';

export const parseHash = () => {
  let hash = window.location.hash;

  hash = decodeURIComponent(hash.replace(/^#\//, ''));

  return tryParse(hash, {});
};

export const setHashProp = (prop, value) => {
  const hash = parseHash();
  hash[prop] = value;
  window.location.hash = `#/${encodeURIComponent(JSON.stringify(hash))}`;
};
