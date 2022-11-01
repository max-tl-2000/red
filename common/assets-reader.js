/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mapKeys from 'lodash/mapKeys';
import loggerModule from './helpers/logger';
import { readJSON } from './helpers/xfs';

const logger = loggerModule.child({ subType: 'get-assets' });

const manifestsCache = {};

const tryReadJSON = async fName => {
  if (manifestsCache[fName]) {
    return manifestsCache[fName];
  }

  let result;

  try {
    result = await readJSON(fName);
    manifestsCache[fName] = result;
  } catch (err) {
    // this error makes no sense in dev since we
    // don't generate the assets in dev, they are
    // processed by webpack-dev-server in memory only
    if (process.env.NODE_ENV === 'production') {
      logger.error({ err }, `readJSON Error file: ${fName}`);
    }
  }

  return result;
};

const assetsReader = {
  async read(jsManifests) {
    const manifestsContent = await Promise.all(jsManifests.filter(manifest => manifest).map(manifest => tryReadJSON(manifest)));

    const assets = manifestsContent.reduce((seq, result) => {
      seq = { ...seq, ...result };
      return seq;
    }, {});

    logger.info({ assets: mapKeys(assets, (value, key) => key.replace(/\./g, '_')), jsManifests }, 'mapped assets');

    return assets;
  },
};

export default assetsReader;
