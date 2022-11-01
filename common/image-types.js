/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const isValidImageMimeType = mimeType => {
  if (!mimeType) {
    throw new Error('MIME_TYPE_IS_REQUIRED');
  }

  const validImageTypes = [/image\/png/i, /image\/jpeg/i, /image\/jpg/i, /image\/gif/i, /image\/webp/i];

  return validImageTypes.some(fileType => !!mimeType.match(fileType));
};
