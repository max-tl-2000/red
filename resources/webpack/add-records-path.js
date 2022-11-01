/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { getCacheFolder } from '../get-cache-folder';

export const addRecordsPath = (config, { isProd, id }) => {
  const cacheDir = getCacheFolder('webpack2-records');
  config.recordsPath = path.join(cacheDir, `records${isProd ? '-prod' : '-dev'}-${id}.json`);
};
