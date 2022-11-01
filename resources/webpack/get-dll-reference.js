/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import webpack from 'webpack';

export const getDllsReferencePlugins = (context, pathToVendorsJSON) => {
  if (!pathToVendorsJSON) return [];
  if (!Array.isArray(pathToVendorsJSON)) {
    pathToVendorsJSON = [pathToVendorsJSON];
  }

  return pathToVendorsJSON.reduce((seq, pathToFile) => {
    seq.push(
      new webpack.DllReferencePlugin({
        context,
        manifest: require(pathToFile), // eslint-disable-line global-require
      }),
    );

    return seq;
  }, []);
};
