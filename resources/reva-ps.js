/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import execp from './execp';

export const listRunningProcesses = async () => {
  const patternsToLook = [
    'node_modules/.bin/bnr',
    'bin/server.js',
    'bin/api.js',
    'bin/decision_api.js',
    'bin/export_api.js',
    'bin/worker.js',
    'bin/socket.js',
    'consumer/bin/server.js',
    'auth/bin/server.js',
  ];

  const cmd = `ps -ax | grep '${patternsToLook.join('\\|')}' --color=always`;
  let res = await execp(cmd);

  res = res
    .split('\n')
    .filter(line => line.indexOf('grep') === -1 && line.indexOf('ps -ax') === -1 && line.indexOf('reva:ps') === -1 && line.indexOf('reva:stop') === -1);

  res = res.join('\n').trim();

  return res;
};

export const getProcesses = async () => {
  const res = await listRunningProcesses();
  const lines = res.split('\n');

  return lines.map(line => line.split(/\s+/)[0].trim()).filter(pId => !!pId);
};
