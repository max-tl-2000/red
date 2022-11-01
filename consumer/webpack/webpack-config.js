/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { makeConfig } from '../../resources/webpack/webpack-config-factory';
import { getOutputFolder } from '../../common/server/dist-folders';

module.exports = makeConfig({
  id: 'consumer',
  cacheInvalidators: ['consumer/webpack/webpack-config.js'],
  context: path.resolve('./'),
  babelConfigPath: path.resolve('./babel.config.js'),
  outputPath: getOutputFolder({ prefix: './consumer' }),
  entry: {
    // by convention, these keys MUST be main + modulename camel-cased
    mainRentapp: ['./rentapp/client/client.js'],
    mainRoommates: ['./roommates/client/client.js'],
    // other entries can be added here
    // applicationSummary: ['./rentapp/client/application-summary'],
  },
  pathToVendorsJSON: path.resolve(getOutputFolder(), 'vendors.json'),
});
