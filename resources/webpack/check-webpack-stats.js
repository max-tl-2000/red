/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable no-new-func */
import { resolve } from 'path';
import { readJSON } from '../../common/helpers/xfs';
import { expand } from '../expand';

export const analyzeStats = async (file, { filter, mapper } = {}) => {
  if (!file) throw new Error('missing argument file argument');

  const stats = await readJSON(resolve(file));
  if (!stats) throw new Error(`cannot read the content of ${file}`);

  let modules;

  if (filter) {
    const filterFn = typeof filter === 'function' ? filter : new Function('module', `return ${filter}`)();

    modules = stats.modules?.filter(filterFn);
  }

  if (mapper) {
    const mapperFn = typeof mapper === 'function' ? mapper : new Function('module', `return ${mapper}`)();

    modules = modules.map(mapperFn).map(m => ({ ...m, __statsFile: file }));
  }

  return modules;
};

export const analyzeFiles = async (patterns, { filter, mapper } = {}) => {
  if (!patterns) throw new Error('patterns argument missing. It can be a string or an string[] with glob patterns');

  const files = await expand({ patterns: Array.isArray(patterns) ? patterns : [patterns] });

  if (files.length === 0) throw new Error('Provided patterns do not match any file');

  let modules = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    modules = modules.concat(await analyzeStats(file, { filter, mapper }));
  }

  return modules;
};
