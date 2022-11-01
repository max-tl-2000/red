/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// this config is for compiling manually the files for debugging purposes
// testcafe binary does not use this file. If any plugin is needed to be added
// it can be added to the module testcafe-babel-config.
//
// This is added here to test the logging injector works as intended
// to test this we can do something like:
//
// ```
// // this will be executed using this babel.config file
// npx babel path/to/file -d dist/
// ```
//
const babelAutoLoggerConfig = require('./babel-auto-logger-config');

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        loose: true,
        targets: {
          node: '6',
        },
      },
    ],
    '@babel/preset-flow',
    '@babel/preset-react',
  ],
  plugins: [
    ['module-resolver', {}],
    [
      '@babel/plugin-proposal-decorators',
      {
        legacy: true,
      },
    ],
    [
      '@babel/plugin-proposal-class-properties',
      {
        loose: true,
      },
    ],
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-do-expressions',
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    babelAutoLoggerConfig,
  ],
  ignore: ['node_modules/**/*.js'],
};
