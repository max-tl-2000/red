/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolve } from 'path';
import { makeVendorsConfig } from '../resources/webpack/webpack-vendors-factory';
import { getOutputFolder } from '../common/server/dist-folders';

const outputPath = getOutputFolder();

module.exports = makeVendorsConfig({
  id: 'vendors-leasing',
  babelConfigPath: resolve('./babel.config.js'),
  context: resolve('./'),
  entry: {
    vendorsLeasing: ['immutable', 'redux', 'react-redux', 'redux-form', 'reselect'],
  },
  pathToVendorsJSON: [resolve(outputPath, 'vendors.json')],
  outputPath,
  manifestFileName: 'vendors-leasing-manifest.json',
});
