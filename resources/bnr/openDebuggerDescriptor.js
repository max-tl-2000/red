/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { error } from 'clix-logger/logger';
import path from 'path';
import execp from '../execp';
import { getCacheFolder } from '../get-cache-folder';

const getChromeBinary = async browserUrl => {
  const htmlFile = path.resolve('resources/debugger/index.html');
  browserUrl = `file://${htmlFile}?debugUrl=${browserUrl}`;
  if (process.platform === 'linux') return `google-chrome '${browserUrl}'`;
  const pathQuery = 'mdfind "kMDItemCFBundleIdentifier=="com.google.Chrome"" | head -1';
  const res = await execp(pathQuery);

  const execPath = res.trim().replace(/\s/g, '\\ ');

  const args = [
    '--allow-external-pages',
    '--allow-file-access-from-files',
    '--allow-insecure-localhost',
    `--user-data-dir=${getCacheFolder('chrome-debugger')}`,
    '--disable-restore-session-state',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    '--disable-translate',
    '--disable-default-apps',
    '--disable-sync',
    '--no-first-run',
    '--noerrdialogs',
    '--start-maximized',
    '--auto-open-devtools-for-tabs',
  ];

  return `open --new --fresh -a ${execPath} --args ${args.join(' ')} '${browserUrl}'`;
};

const descriptor = {
  cmd: async ({ args }) => { // eslint-disable-line
    const request = require('superagent'); // eslint-disable-line
    const port = args.debugPort || 9229;

    try {
      const res = await request.get(`http://localhost:${port}/json`);
      const chromeUrl = res.body[0].devtoolsFrontendUrl.replace('https://chrome-devtools-frontend.appspot.com', 'chrome-devtools://devtools/remote');
      const browserCmd = await getChromeBinary(chromeUrl);

      return browserCmd;
    } catch (err) {
      error('open:debugger request error', err);
      process.exit(1); // eslint-disable-line
    }
  },
};

export default descriptor;
