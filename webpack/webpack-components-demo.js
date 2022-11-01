/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { makeConfig } from '../resources/webpack/webpack-config-factory';
import { getOutputFolder } from '../common/server/dist-folders';

const isProd = process.env.NODE_ENV === 'production';
const outputPath = getOutputFolder();

const externals = !isProd
  ? {}
  : {
      'redux-logger': 'window.__noop__',
      'redux-devtools': 'window.__noop__',
      'redux-devtools-log-monitor': 'window.__noop__',
      'redux-devtools-dock-monitor': 'window.__noop__',
      'mobx-react-devtools': 'window.__noop__',
    };

module.exports = makeConfig({
  id: 'componentsDemo',
  cacheInvalidators: ['webpack/webpack-components-demo.js'],
  context: path.resolve('./'),
  externals,
  babelConfigPath: path.resolve('./babel.config.js'),
  outputPath,
  entry: {
    iframeTest: ['./client/demo/iframe-test.js'],
    componentsDemo: ['./client/demo/index.js'],
  },
  pathToVendorsJSON: [path.resolve(outputPath, 'vendors.json')],
  manifestFileName: 'components-demo-manifest.json',
});
