/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { makeConfig } from '../resources/webpack/webpack-config-factory';
import { getOutputFolder } from '../common/server/dist-folders';

module.exports = makeConfig({
  id: 'polyfills',
  cacheInvalidators: ['webpack/webpack-config-polyfill.js'],
  context: path.resolve('./'),
  babelConfigPath: path.resolve('./babel.config.js'),
  outputPath: getOutputFolder(),
  entry: {
    polyfills: ['./common/client/polyfill.js'],
  },
  pathToVendorsJSON: [],
  forceProd: true,
  manifestFileName: 'polyfills-manifest.json',
});
