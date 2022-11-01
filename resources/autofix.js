/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import tm from 'shell-executor/time-manager';
import { subtle, ok, error, success } from './logger';
import { updatePATH } from './npm-bin-path';
import execCommand from './exec-command';
import { getChangedAssets } from './git-helper';

const execTask = (condition, failureMessage, task) => {
  if (!condition) {
    subtle(failureMessage);
    return Promise.resolve();
  }
  return task();
};

export const autofixFiles = async (args = {}, env = {}) => {
  const timer = tm.start();

  const compareWithHEAD = args['compare-head'];
  const includeOthers = args['include-others'];
  const noFix = args['no-fix'];

  await updatePATH();

  const files = await getChangedAssets({ compareWithHEAD, includeOthers });

  if (files.js.length === 0 && files.css.length === 0) {
    ok('No files to lint');
    return;
  }

  subtle('Files to check\n   -', files.all.join('\n   - '), '\n');

  const fixFlag = noFix ? '' : '--fix';

  const lintCMD = `babel-node --extensions '.ts,.js,.json' ./resources/lint-files ${files.js.join(' ')} ${fixFlag}`;
  const scssCMD = `babel-node --extensions '.ts,.js,.json' ./resources/lint-files ${files.css.join(' ')} --type=scss ${fixFlag}`;

  const [lintSuccess] = await Promise.all([
    execTask(files.js.length, 'No js files to lint', () => execCommand(lintCMD, { id: 'lint changed js files', env })),
    execTask(files.css.length, 'No css files to lint', () => execCommand(scssCMD, { id: 'lint changed scss files', env })),
  ]);

  if (typeof lintSuccess === 'boolean') {
    lintSuccess ? success('lint done!\n') : error('lint failed!\n');
  }

  const res = timer.stop();
  ok('lint done in', res.diffFormatted);
};
