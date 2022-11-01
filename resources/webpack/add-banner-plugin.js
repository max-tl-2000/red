/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import webpack from 'webpack';

export const addBannerPlugin = config => {
  const date = new Date();
  const banner = `
/*!
 * Copyright (c) ${date.getFullYear()} Reva Technology Inc
 * */
  `.trim();

  config.plugins.push(new webpack.BannerPlugin({ banner, raw: true }));
};
