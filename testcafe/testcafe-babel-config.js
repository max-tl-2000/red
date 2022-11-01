/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const babelAutoLoggerConfig = require('./babel-auto-logger-config');

module.exports = {
  // handler that allows us to modify the babel configuration that testcafe will use to
  // process the files. Here we can inject new plugins or change other babel configurations
  // that we would need
  processOptions: opts => {
    const { filename } = opts;
    // inject logger to files inside
    // - helpers
    // - suites
    // - pages
    //
    // except to (becasue already has enough logging)
    // - helpers/helpers.js
    // - helpers/hooks.js
    if (!filename.match(/testcafe\/helpers\/helpers|testcafe\/helpers\/hooks/) && filename.match(/testcafe\/helpers\/|testcafe\/suites\/|testcafe\/pages\//)) {
      return {
        ...opts,
        plugins: [...opts.plugins, babelAutoLoggerConfig],
      };
    }

    return opts;
  },
};
