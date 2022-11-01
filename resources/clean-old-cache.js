/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { subtle } from 'clix-logger/logger';
import execp from './execp';
import { exists, stat, readDirectory } from '../common/helpers/xfs';
import { getBaseCacheFolder } from './get-cache-folder';
import trim from '../common/helpers/trim';

const findLocalModules = async () => {
  const baseDirectory = path.resolve('./local_modules');
  const entries = await readDirectory(baseDirectory);
  const dirs = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const filePath = path.join(baseDirectory, entry);
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      dirs.push(entry);
    }
  }

  return dirs;
};

const getCleanFilesInDirCmds = async (dir, { olderThan = 4 } = {}) => {
  dir = path.resolve(dir);

  if (!(await exists(dir))) {
    subtle('cache folder not found... skipping cache clean up');
    return [];
  }

  return [
    // delete the files that are older than 4 days
    `find ${dir} -atime +${olderThan} -exec rm -rfv '{}' \\; || true`,
    // delete empty directories... somehow this was required to ensure
    // that no empty folder were left from the previous command
    `find ${dir} -mindepth 1 -type d -empty -delete || true`,
  ];
};

export const cleanOldCache = async () => {
  const getYarnCacheDir = async () => trim(await execp('yarn cache dir'));
  const yarnCacheDir = await getYarnCacheDir();
  const localModules = await findLocalModules();

  const commandsToRemoveCache = localModules.map(moduleName => {
    const modulePattern = path.join(yarnCacheDir, `npm-${moduleName}*`);
    return `rm -rf ${modulePattern} || true`;
  });

  const babelCacheDir = getBaseCacheFolder();

  return [...commandsToRemoveCache, ...(await getCleanFilesInDirCmds(babelCacheDir))];
};
