/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import SpeedMeasurePlugin from 'speed-measure-webpack-plugin';

import { makeConfig } from '../resources/webpack/webpack-config-factory';
import { getOutputFolder } from '../common/server/dist-folders';

const isProd = process.env.NODE_ENV === 'production';
const outputPath = getOutputFolder();

const smp = new SpeedMeasurePlugin();

const externals = !isProd
  ? {}
  : {
      'redux-logger': 'window.__noop__',
      'redux-devtools': 'window.__noop__',
      'redux-devtools-log-monitor': 'window.__noop__',
      'redux-devtools-dock-monitor': 'window.__noop__',
      'mobx-react-devtools': 'window.__noop__',
    };

const useMeasurePlugin = process.env.MEASURE_BUNDLE_TIME === 'true';

const cfg = makeConfig({
  id: 'leasing',
  cacheInvalidators: ['webpack/webpack-config.js'],
  context: path.resolve('./'),
  externals,
  babelConfigPath: path.resolve('./babel.config.js'),
  outputPath,
  entry: {
    main: ['./client/client.js'],
  },
  pathToVendorsJSON: [path.resolve(outputPath, 'vendors.json'), path.resolve(outputPath, 'vendorsLeasing.json')],
});

const config = useMeasurePlugin ? smp.wrap(cfg) : cfg;

module.exports = config;
