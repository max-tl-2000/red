/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const getPropertyIdFromURLFragment = (url: string): string => {
  if (url && typeof url !== 'string') throw new TypeError('url is expected to be an string');
  const urlPathParts = (url || '').split(/\//g);

  const indexOfProperties = urlPathParts.findIndex(part => part.match(/\bproperties\b/));

  if (indexOfProperties > -1) {
    const propertyId = urlPathParts[indexOfProperties + 1];

    if (!propertyId) return '';
    return propertyId;
  }

  return '';
};
