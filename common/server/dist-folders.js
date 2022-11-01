/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolve } from 'path';

export const getDistFolderName = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const forceProd = process.env.USE_ASSETS_PROD_DIST_FOLDER === 'true';
  return isProd || forceProd ? 'dist' : 'dev-dist';
};

export const getOutputFolder = ({ prefix = '.' } = {}) => {
  const dist = getDistFolderName();
  return resolve(prefix, 'static', dist);
};
