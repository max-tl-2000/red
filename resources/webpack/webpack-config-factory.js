/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import webpack from 'webpack';
import strip from 'strip-loader';
import trim from '../../common/helpers/trim';
import { configureCSSSupport } from './configure-css-support';

import { addBabelLoader } from './get-babel-loader';
import { getDllsReferencePlugins } from './get-dll-reference';

import { addBannerPlugin } from './add-banner-plugin';
import { addManifestPlugin } from './add-manifest-plugin';
import { getDistFolderName } from '../../common/server/dist-folders';

const getEnvBool = variable => trim(process.env[variable]) === 'true';

export const makeConfig = ({
  id,
  entry,
  externals = {},
  noExternals,
  context,
  babelConfigPath,
  outputPath,
  main,
  pathToVendorsJSON,
  extraExternals,
  manifestFileName = 'main-manifest.json',
  forceProd,
}) => {
  const REDUX_DEVTOOLS = getEnvBool('DEVTOOLS');
  const MOBX_DEVTOOLS = getEnvBool('MOBX_DEVTOOLS');
  const PROD_MODE = process.env.NODE_ENV === 'production' || forceProd;

  // Cucumber does not run properly when hot reload is enabled
  // so we skip it if the SKIP_HOT_RELOAD env variable is set
  const USE_HOT_RELOAD = process.env.SKIP_HOT_RELOAD !== 'true';

  const loaders = [];

  let webpackPlugins = getDllsReferencePlugins(context, pathToVendorsJSON);

  if (PROD_MODE) {
    loaders.push({
      test: /\.js$/,
      exclude: /node_modules/,
      loader: strip.loader('debug'),
    });

    const defaultDefinitions = {
      __DEVTOOLS__: '__REDUX_DEV_TOOLS__',
      __MOBX_DEVTOOLS__: false,
      'process.env.NODE_ENV': '__RED_PROD_MODE__',
      'process.env.CUCUMBER_CI_JOB': process.env.CUCUMBER_CI_JOB === 'true',
      ...extraExternals,
    };

    webpackPlugins = webpackPlugins.concat([
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new webpack.DefinePlugin(defaultDefinitions),
    ]);
  } else {
    if (USE_HOT_RELOAD) {
      const rhlPatch = 'react-hot-loader/patch';
      const hotMiddlewareClient = `webpack-hot-middleware/client?path=/__webpack_hmr&name=${id}`;
      if (main) {
        main.unshift(rhlPatch, hotMiddlewareClient);
      }

      if (entry) {
        Object.keys(entry).forEach(key => {
          entry[key].unshift(rhlPatch, hotMiddlewareClient);
        });
      }
    }

    webpackPlugins = webpackPlugins.concat([
      // hot reload
      new webpack.HotModuleReplacementPlugin(),
      new webpack.DefinePlugin({
        __MOBX_DEVTOOLS__: MOBX_DEVTOOLS,
        __DEVTOOLS__: REDUX_DEVTOOLS,
        'process.env': {
          // replacing all instances of process.env.NODE_ENV with development
          NODE_ENV: '"development"',
          CUCUMBER_CI_JOB: process.env.CUCUMBER_CI_JOB === 'true',
        },
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
    ]);
  }

  // if main option is set
  // we ignore the entry option
  if (main) {
    entry = {
      main,
    };
  }

  const config = {
    name: id,
    mode: 'none', // we handle the modes
    // best performance is achieved with `eval`. It takes 1-1.5s per rebuild
    // `source-map` can't be cached. It takes 4-6s per rebuild
    // `eval-source-map` can be cached, but it is still slow 3-4s per rebuild
    devtool: PROD_MODE ? 'source-map' : process.env.WP_DEVTOOL || 'eval-source-map',
    context,
    cache: true,
    externals: noExternals
      ? {}
      : {
          jquery: 'jQuery',
          Materialize: 'Materialize',
          moment: 'moment',
          noUiSlider: 'noUiSlider',
          plivo: 'window.Plivo',
          // needed becasue of react-html-email which needs to support the previous React version.
          // bundled code will use the newest version so we don't need this one
          'react/lib/DOMProperty': 'window.__noop__',
          ...externals,
        },
    stats: {
      children: false,
    },
    entry,
    output: {
      path: outputPath,
      filename: '[name].js',
      publicPath: `/${getDistFolderName()}/`,
      pathinfo: false,
    },
    optimization: {
      noEmitOnErrors: true,
    },
    module: {
      strictExportPresence: true,
      rules: [
        {
          test: /\.svg$/,
          use: [
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
        },
        {
          test: /(\.png|\.jpg)$/,
          use: [{ loader: 'url-loader', options: { limit: 100000 } }],
        },
      ],
    },
    resolve: {
      unsafeCache: !PROD_MODE,
      modules: ['client', 'node_modules', 'common'],
      extensions: ['.json', '.js', '.ts', '.tsx'],
      fallback: {
        // path is used by upload components to do some filename
        // checks
        path: require.resolve('path-browserify'),
        crypto: false,
        stream: false,
        fs: false,
        buffer: require.resolve('buffer/'),
      },
    },
    plugins: webpackPlugins,
    performance: {
      hints: PROD_MODE ? 'warning' : false,
    },
  };

  configureCSSSupport({ config, extractText: PROD_MODE });
  addBabelLoader({ config, babelConfigPath, isProd: PROD_MODE, hot: USE_HOT_RELOAD, chromeOnly: process.env.DEV_CHROME_ONLY === 'true' });
  addBannerPlugin(config);
  addManifestPlugin(config, manifestFileName);

  return config;
};
