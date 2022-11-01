/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const escapeRegex = value => value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

export const matchQuery = (query, item) => {
  const text = item.text.toLowerCase();
  const id = item.id.toLowerCase();
  const term = query.toLowerCase();
  const matcher = new RegExp(`^${escapeRegex(term)}`, 'i');
  const match = text.match(matcher) || id.match(matcher);

  return match;
};
