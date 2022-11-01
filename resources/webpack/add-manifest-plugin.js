/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { WebpackManifestPlugin } from 'webpack-manifest-plugin';

export const addManifestPlugin = (config, manifestFileName) => {
  config.plugins.push(
    new WebpackManifestPlugin({
      publicPath: '',
      fileName: manifestFileName,
    }),
  );
};
