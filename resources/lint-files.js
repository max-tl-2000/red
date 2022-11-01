/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minimist from 'minimist';
import fileEntryCache from 'file-entry-cache';
import flatCache from 'flat-cache';
import hasha from 'hasha';
import tm from 'shell-executor/time-manager';
import stringify from 'json-stable-stringify';
import execCommand from './exec-command';
import { ok, error, subtle } from './logger';
import { updatePATH } from './npm-bin-path';
import { expand } from './expand';
import { getCacheFolder } from './get-cache-folder';
import eslintrcConfig from '../.eslintrc';

const hash = str => hasha(str, { algorithm: 'md5' });

const didConfigChange = (configCache, config, args) => {
  const configHashPersisted = configCache.getKey('configHash');
  const argsHashPersisted = configCache.getKey('argsHash');

  const hashOfConfig = hash(stringify(config));
  const hashOfArgs = hash(stringify(args));
  const configChanged = configHashPersisted !== hashOfConfig || argsHashPersisted !== hashOfArgs;

  if (configChanged) {
    subtle('cache will be ignored because configuration or arguments changed');
    configCache.destroy();
    configCache.setKey('argsHash', hashOfArgs);
    configCache.setKey('configHash', hashOfConfig);
  }
  return configChanged;
};

const getChangedFiles = async (cache, patterns) => {
  let files = await expand({ patterns });
  const excludes = [/static\//, /node_modules\//, /\/generated-routes\//, /resources\/svgs\/sprite\.js/];
  // exclude files that match the static folder
  files = files.filter(file => !excludes.some(regx => file.match(regx)));
  return cache.getUpdatedFiles(files);
};

const getCommand = (argv, files) => {
  if (argv.type === 'scss') {
    // we don't need the cache from the module since we're manually
    // calculating the files to check
    return `cssbrush --no-use-cache ${argv.fix ? '' : '-k'} ${files.join(' ')}`;
  }

  const joinedFiles = files.join(' ');
  const fixArg = argv.fix ? '--fix' : '';
  return `eslint --cache --cache-location node_modules/.cache/ -f friendly ${joinedFiles} ${fixArg}`;
};

const main = async () => {
  const timer = tm.start();
  await updatePATH();

  const argvs = process.argv.slice(2);

  const argv = minimist(argvs);

  const cacheDir = getCacheFolder('lint-cache');

  const type = argv.type === 'scss' ? 'scss' : 'js';
  const cacheName = `${type}-cache`;
  const configCacheName = `${type}-config-cache`;

  const cache = fileEntryCache.create(cacheName, cacheDir);
  const configCache = flatCache.create(configCacheName, cacheDir);

  if (didConfigChange(configCache, eslintrcConfig, argv._.join(' '))) {
    cache.destroy();
  }

  const files = await getChangedFiles(cache, argv._);

  let success = true; // assume true
  if (files.length > 0) {
    success = await execCommand(getCommand(argv, files), { id: argv.fix ? `fix ${type} files` : `lint ${type} files` });
  } else {
    subtle(`No ${type} files to lint`);
  }

  const res = timer.stop();

  if (success) {
    // save the cache in case the process succeed
    configCache.save();
    cache.reconcile();
    ok(`lint ${type} files done!. Took:`, res.diffFormatted);
  } else {
    error(`Lint ${type} files error. Took:`, res.diffFormatted);
    // eslint-disable-next-line
    process.exit(1); // make sure the process fails if there are errors
  }
};

main().catch(err => error(err));
