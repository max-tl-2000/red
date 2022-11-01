/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../helpers/logger';

/* eslint-disable global-require */
export const setupWebpackDevServer = (app, { webpackConfigs = [] } = {}) => {
  if (!webpackConfigs.length > 0) throw new Error('No webpack configs provided');
  const webpack = require('webpack'); // eslint-disable-line

  app.use((req, res, next) => {
    // this fix is needed to make it work when using nginx
    if (req.url.indexOf('__webpack_hmr') > -1) {
      // as described here
      // http://stackoverflow.com/a/27960243/538752
      res.set('X-Accel-Buffering', 'no');
    }
    next();
  });

  const compiler = webpack(webpackConfigs);

  const serverOptions = {
    // contentBase,
    // quiet: true,
    // noInfo: true,
    // hot: true,
    // inline: true,
    // The lazy option was removed in express 4 without replacement
    // what it did:
    // -This option instructs the module to operate in 'lazy' mode, meaning that it won't
    // - recompile when files change, but rather on each request.
    // lazy: false,
    publicPath: webpackConfigs[0].output.publicPath,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    stats: {
      colors: true,
    },
  };

  app.use(require('webpack-dev-middleware')(compiler, serverOptions));
  app.use(require('webpack-hot-middleware')(compiler));
  logger.info({ webpackConfigs, serverOptions }, 'Dev server has been configured');
};
