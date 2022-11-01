/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolve } from 'path';
import { makeVendorsConfig } from '../resources/webpack/webpack-vendors-factory';
import { getOutputFolder } from '../common/server/dist-folders';

const isProd = process.env.NODE_ENV === 'production';

let vendors = [
  'react',
  'react-dom',
  'react-document-meta',
  '@redisrupt/velocity-react',
  'mobx',
  'mobx-react',
  'debouncy',
  'velocity-animate',
  'velocity-animate/velocity.ui',
  'react-router',
  'accounting',
  'react-transition-group',
  'react-dropzone',
  'i18next',
  'resize-observer-polyfill',
  'uuid/v4',
  'uuid/v1',
  'superagent',
  'dispatchy',
  './resources/svgs/sprite',
  './common/currency',
  'engine.io-client',
  'engine.io-parser',
  'socket.io-client',
  'socket.io-parser',
  'marked',
  'jquery-ui/ui/position.js',
];

if (!isProd) {
  vendors = vendors.concat(['redux-logger', 'redux-devtools', 'redux-devtools-log-monitor', 'redux-devtools-dock-monitor', 'mobx-react-devtools']);
}

// in components demo we need to be able to
// hot reload the components so we cannot just serve them
// from the vendors bundle, but we need to make it
// be part of the componentsDemo bundle
// MAM this is breaking cucumber tests (and potentially prod as well)
// because z-index-manager is being served from both bundles
// disabling for now
// if (isProd || process.env.INCLUDE_COMPONENTS_IN_VENDORS === 'true') {
//  vendors = vendors.concat(['./client/components/index']);
// }

module.exports = makeVendorsConfig({
  id: 'vendors',
  babelConfigPath: resolve('./babel.config.js'),
  context: resolve('./'),
  entry: {
    vendors,
  },
  outputPath: getOutputFolder(),
  manifestFileName: 'vendors-manifest.json',
});
