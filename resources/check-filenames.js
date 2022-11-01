/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import minimist from 'minimist';
import path from 'path';
import fileEntryCache from 'file-entry-cache';
import { expand } from './expand';
import { subtle, ok, error, warn } from './logger';
import { getCacheFolder } from './get-cache-folder';

const getCacheFile = () => path.join(getCacheFolder('check-files'), 'cache.json');

const argv = minimist(process.argv.slice(2));
const { warnOnly, ignoreMatch } = argv;

const theMatchesToIgnore = ignoreMatch ? (Array.isArray(ignoreMatch) ? ignoreMatch : [ignoreMatch]) : null; // eslint-disable-line

const forbiddenChars = ['_'];
// to exclude folders like __tests__, __integration__,  etc.
const whilelisted = [/__([a-z\d.-]+)__/];

const hasForbiddenChars = fName => {
  if (whilelisted.some(regexp => fName.match(regexp))) {
    return false;
  }

  return forbiddenChars.some(char => fName.includes(char));
};

const checkFiles = files =>
  files.reduce((acc, file) => {
    const fName = path.basename(file);

    if (fName.toLowerCase() !== fName || hasForbiddenChars(fName)) {
      if (theMatchesToIgnore) {
        if (!theMatchesToIgnore.includes(file)) {
          acc.push(file);
        }
      } else {
        acc.push(file);
      }
    }

    return acc;
  }, []);

const printResults = files => {
  const header = `The following files or dirs should be kebab-case and not include: ${forbiddenChars.join(', ')}`;
  const affectedFiles = files.map(file => `    - ${file}`).join('\n');
  subtle(`${header}\n\n${affectedFiles}\n`);
};

const main = async () => {
  const patterns = argv._;
  subtle('check filenames started');

  let files = await expand({ patterns, includeFolders: true });

  files = files.filter(file => !(file.match(/static\/dist/) || file.match(/static\/dev-dist/)));

  const cacheFile = getCacheFile();
  const fEntryCache = fileEntryCache.createFromFile(cacheFile);

  files = fEntryCache.getUpdatedFiles(files);

  if (files.length === 0) {
    subtle('no files have changed since last execution...');
  }

  const result = checkFiles(files);

  if (result.length > 0) {
    printResults(result);

    if (warnOnly) {
      warn('check filenames failed!');
    } else {
      error('check filenames failed!');
      // eslint-disable-next-line
      process.exit(1); // to enable failure
    }

    return;
  }

  fEntryCache.reconcile();
  ok('check filenames done. All good!');
};

main().catch(err => error(err));
