/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { IS_WORD_FILE, IS_PDF_FILE, IS_IMAGE_FILE } from '../regex';

const iconHash = {
  file: 'file',
  word: 'file-word',
  pdf: 'file-pdf',
  img: 'file-image',
};

export const getIconName = fileName => {
  const ext = path.extname(fileName).substring(1);

  const key = (ext.match(IS_WORD_FILE) && 'word') || (ext.match(IS_PDF_FILE) && 'pdf') || (ext.match(IS_IMAGE_FILE) && 'img') || 'file';

  return iconHash[key];
};
