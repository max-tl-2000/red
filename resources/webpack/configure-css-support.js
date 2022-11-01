/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolve } from 'path';
import webpack from 'webpack';
import autoprefixer from 'autoprefixer';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
// import { getCacheInterface } from './cache-interface';

export const configureCSSSupport = ({ config, extractText }) => {
  // const cacheInterface = getCacheInterface('css');

  const scssLoader = {
    test: /\.scss$/,
    exclude: /node_modules/,
    use: [
      !extractText ? { loader: 'cache-loader' /* , options: cacheInterface */ } : null,
      { loader: 'css-local-loader' },
      { loader: 'style-loader', options: { sourceMap: true } },
      {
        loader: 'css-loader',
        options: {
          sourceMap: true,
          importLoaders: 1,
          modules: {
            localIdentName: '[local]_[hash:base64:5]',
          },
        },
      },
      // Do not enable this in dev mode as it doubles the compile time
      // { loader: 'postcss-loader', options: { sourceMap: true, plugins: () => [autoprefixer({ browsers: ['last 2 versions'] })] } },
      // ℹ We strongly discourage change outFile, sourceMapContents, sourceMapEmbed, sourceMapRoot options because sass-loader automatically sets these options when the sourceMap option is true.
      { loader: 'sass-loader', options: { sourceMap: true, sassOptions: { outputStyle: 'expanded' } } },
    ].filter(entry => !!entry),
  };

  // default css loader, used for dev
  const cssLoader = {
    test: /\.css$/,
    use: [
      !extractText ? { loader: 'cache-loader' /* , options: cacheInterface */ } : null,
      { loader: 'style-loader', options: { sourceMap: true } },
      { loader: 'css-loader', options: { sourceMap: true } },
    ].filter(entry => !!entry),
  };

  if (extractText) {
    config = {
      ...config,
      optimization: {
        ...config.optimization,
        splitChunks: {
          ...(config.optimization || {}).splitChunks,
          cacheGroups: {
            styles: {
              name: 'styles',
              test: /\.css$/,
              chunks: 'all',
              enforce: true,
            },
          },
        },
      },
    };
    scssLoader.use = [
      { loader: MiniCssExtractPlugin.loader, options: { esModule: false } },
      { loader: 'css-loader', options: { sourceMap: true, modules: true, importLoaders: 2 } },
      { loader: 'postcss-loader', options: { sourceMap: true, plugins: [autoprefixer({ browsers: ['last 2 versions'] })] } },
      { loader: 'sass-loader', options: { sourceMap: true } },
    ];

    cssLoader.use = [{ loader: MiniCssExtractPlugin.loader, options: { esModule: false } }, { loader: 'css-loader' }];

    config.plugins.push(
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
    );

    config.module.rules.push({
      test: /\.scss$/,
      exclude: /node_modules/,
      use: [{ loader: 'css-local-loader' }],
    });
  }

  config.module.rules.push(scssLoader);
  config.module.rules.push(cssLoader);

  config.plugins.push(
    new webpack.LoaderOptionsPlugin({
      options: {
        context: '/',
        sassLoader: {
          includePaths: [resolve('./node_modules/')],
        },
      },
    }),
  );
};
