/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ok, subtle, error } from 'clix-logger/logger';
import { del, mkdirp } from '../../common/helpers/xfs';

const outputDirPath = './cucumber/output/';

export async function clean() {
  await del([`${outputDirPath}/`], { force: true });
  subtle('>> cucumber output removed!');

  await mkdirp(outputDirPath);
  subtle('>> output folder created');
}

export async function doClean() {
  try {
    await clean();
    ok('>> cleaning done');
  } catch (err) {
    error('>> clean error', err);
  }
}

doClean();
