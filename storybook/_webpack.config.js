/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { configureCSSSupport } from '../resources/webpack/configure-css-support';
import { addCachePlugin } from '../resources/webpack/cache-plugin';

const config = {
  cache: true,
  plugins: [],
  externals: {
    jquery: 'jQuery',
    Materialize: 'Materialize',
    moment: 'moment',
    noUiSlider: 'noUiSlider',
  },
  module: {
    rules: [
      {
        test: /(\.png|\.jpg)$/,
        use: [{ loader: 'url-loader', options: { limit: 100000 } }],
      },
      {
        test: /\.json$/,
        include: [path.resolve('./node_modules/react-html-email/lib/')],
        use: [{ loader: 'json-loader' }],
      },
    ],
  },
  resolve: {
    modules: ['client', 'node_modules', 'common'],
    extensions: ['.json', '.js'],
  },
};

configureCSSSupport({ config, extractText: false });
addCachePlugin(config, { isProd: false, id: 'storybook' });

config.module.rules.unshift({
  test: /\.svg$/,
  use: [
    'babel-loader',
    {
      loader: '@redisrupt/react-svg-loader',
      options: {
        svgo: {
          // svgo options
          plugins: [{ removeTitle: false }],
          floatPrecision: 2,
        },
      },
    },
  ],
});

module.exports = config;
