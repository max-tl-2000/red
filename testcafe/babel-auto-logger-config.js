/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const path = require('path');
const pathToLogger = path.resolve('./logger-adapter.js');

module.exports = [
  'babel-plugin-auto-logger',
  {
    loggingData: {
      name: '__revaLogger__',
      source: pathToLogger,
      /**
       * whether if we should inject the logger into a given function
       */
      skipLogger: nodePath => {
        const { parent } = nodePath;
        if (!parent) return true;

        const { callee = {} } = parent;

        // we should not inject the logger inside the client functions as they are executed
        // inside the browser and the injected logger is not avaiable there
        const shouldSkip = parent.type === 'CallExpression' && callee.name === 'ClientFunction';

        return shouldSkip;
      },
    },
  },
];
