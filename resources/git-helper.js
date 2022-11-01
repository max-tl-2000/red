/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import expandGlobs from 'clix/lib/expand-globs';
import execp from './execp';
import envVal from '../common/helpers/env-val';
import { stat } from '../common/helpers/xfs';

export const parseFiles = async cmd => {
  const files = await execp(cmd);
  return files.trim().split('\n');
};

export const getAllChangedFiles = async ({ compareWithHEAD, resolvePaths, targetGitBranch, includeOther }) => {
  targetGitBranch = targetGitBranch || envVal('TARGET_GIT_BRANCH', 'master');
  let files = [];
  const isCI = process.env.CI === 'true';
  const origin = isCI ? 'origin/' : '';
  const branch = compareWithHEAD ? 'HEAD' : `${origin}${targetGitBranch}`;

  files = files.concat(await parseFiles(`git diff ${branch} --name-only`));
  if (includeOther) {
    files = files.concat(await parseFiles('git ls-files --other --exclude-standard'));
  }

  files = expandGlobs(files, { resolvePaths }); // remove non existing and optionally fully resolve the path

  const retFiles = [];
  for (let i = 0; i < files.length; i++) {
    const currentFile = files[i];
    const fileStat = await stat(currentFile);
    if (fileStat.isFile()) {
      retFiles.push(currentFile);
    }
  }

  return retFiles;
};

export const getChangedAssets = async args => {
  const files = await getAllChangedFiles(args);

  const jsFiles = files.filter(
    file =>
      file.match(/\.js$|\.ts$/) &&
      !file.match(/static/) &&
      // ignore AWS files for now. TODO: Check if we should
      // transpile the code under AWS folder
      !file.match(/aws/) &&
      // ignore the eslintrc.js file which is ignored by default
      // this is only to avoid autofix showing errors about this file
      !file.match(/\.eslintrc\.js/),
  );

  const scssFiles = files.filter(file => (file.match(/\.scss$/) || file.match(/\.css$/)) && !file.match(/mixins\.scss$/) && !file.match(/static/));

  return {
    all: jsFiles.concat(scssFiles),
    js: jsFiles,
    css: scssFiles,
  };
};
