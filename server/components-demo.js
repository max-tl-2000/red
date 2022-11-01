/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Express from 'express';
import path from 'path';
import { createServer } from '../common/server/common-server';
import { getAssets } from '../common/server/get-assets';
import logger from '../common/helpers/logger';
import { getDistFolderName } from '../common/server/dist-folders';
import { doRender } from './render-helpers';
import Index from './views/index';

const distFolderName = getDistFolderName();

const registerComponentsDemoPath = app => {
  console.log('>>> registerComponentsDemoPath');
  app.use('/', async (req, res, next) => {
    const host = req.get('host');
    console.log('>>> host from req', host);

    logger.debug('serving `/components-demo` route');

    const { jsAssets, cssAssets } = await getAssets({
      host,
      query: req.query,
      useDevMode: true,
      jsManifests: [path.resolve(`./static/${distFolderName}/vendors-manifest.json`), path.resolve(`./static/${distFolderName}/components-demo-manifest.json`)],
      cssFiles: ['vendors.css', { name: 'componentsDemo.css', skipInDev: true }],
      jsFiles: ['vendors.js', { name: 'componentsDemo.js', dev: true }],
    });

    const props = {
      jsAssets,
      cssAssets,
      title: 'Components demo',
    };

    await doRender(Index, { req, res, next, props });
  });
};

const main = async () => {
  const app = new Express();
  const serverPort = 4000;

  const webpackConfigPath = [
    // '../webpack/webpack-config', '../webpack/webpack-pages',
    '../webpack/webpack-components-demo',
  ];

  const server = await createServer(app, {
    needMiddleware: false,
    baseDir: __dirname,
    pathToStatic: '../static/',
    pathToFavicons: path.resolve(__dirname, '../resources/favicons'),
    logger,
    config: { serverPort, isDevelopment: true },
    webpackConfigPath,
  });

  console.log('>>> registerComponentsDemoPath');
  registerComponentsDemoPath(app);
  server.start();
};

main().catch(reason => logger.error({ reason }, 'Error starting components-demo server'));
