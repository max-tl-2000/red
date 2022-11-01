/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// import { getCacheInterface } from './cache-interface';

export const getBabelLoader = ({ isProd, babelConfigPath, hot, chromeOnly }) => {
  // const cacheInterface = getCacheInterface('babel');
  const babelrc = require(babelConfigPath); // eslint-disable-line global-require

  // override the babel config to target browsers instead of node
  const envPreset = babelrc.presets[0];
  const presetConfig = envPreset[1];
  presetConfig.modules = false;

  presetConfig.targets = { browsers: isProd ? ['last 2 versions'] : [`last 2 ${chromeOnly ? 'Chrome ' : ''}versions`] };

  const babelLoaderOptions = {
    babelrc: false, // this is important to prevent babel from trying to use the babelrc
    presets: babelrc.presets,
    cacheDirectory: true,
    plugins: babelrc.plugins,
  };

  const babelLoader = {
    test: /\.ts$|\.js$|\.svg$/,
    exclude: file => file.match(/\/node_modules\//),
    use: [
      !isProd ? { loader: 'cache-loader' /* , options: cacheInterface */ } : null,
      {
        loader: 'babel-loader',
        options: babelLoaderOptions,
      },
    ].filter(desc => !!desc),
  };

  if (!isProd && hot) {
    babelLoaderOptions.plugins = babelLoaderOptions.plugins.concat(['react-hot-loader/babel']);
  }

  return babelLoader;
};

export const addBabelLoader = ({ config, ...rest }) => {
  const babelLoader = getBabelLoader(rest);
  config.module.rules.unshift(babelLoader);
};
