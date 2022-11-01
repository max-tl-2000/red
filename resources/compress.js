/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import minimist from 'minimist';
import flatCache from 'flat-cache';
import hasha from 'hasha';
import tm from 'shell-executor/time-manager';
import stringify from 'json-stable-stringify';
import { updatePATH } from './npm-bin-path';
import { readJSON, stat, glob, write, read } from '../common/helpers/xfs';
import execCommand from './exec-command';
import { ok, error, success, subtle, warn, print } from './logger';
import { getCacheFolder } from './get-cache-folder';

// round using 2 decimal places
const round2 = num => +`${Math.round(`${num}e+2`)}e-2`;

// returns the size in mb of a given file
const getSizeInMB = async path2File => {
  const { size } = await stat(path2File);
  const sizeInMb = size / 1024 / 1024;
  return round2(sizeInMb); // size in mb
};

// given several manifests files
// merge them into a single object
const mergeManifests = async files => {
  let result = {};

  for (let i = 0; i < files.length; i++) {
    const content = await readJSON(files[i]);
    result = { ...result, ...content };
  }

  return result;
};

/**
 * Produces minified versions and source maps of all CSS and JS
 * files specified in manifest.json, additionally substituting
 * RED_PROD_MODE with 'production' so the minified version removes the
 * dead code.
 */
const main = async () => {
  await updatePATH();
  const timer = tm.start();

  const argv = minimist(process.argv.slice(2));

  const basePath = argv.manifestDir || './static/dist/';
  const manifestGlob = argv.manifestFile || '*manifest.json';

  const manifestFiles = await glob(path.join(basePath, manifestGlob));
  const manifest = await mergeManifests(manifestFiles);

  const id = argv.id || hasha(stringify(manifest), { algorithm: 'md5' });

  const cacheFile = `cache-${id}`;
  const cacheDir = getCacheFolder('compress');

  const isImageBuilder = process.env.IMAGE_BUILDER === 'true';
  const isCucumberJob = process.env.CUCUMBER_CI_JOB === 'true';
  const useCache = process.env.RED_USE_COMPRESS_CACHE === 'true';

  const skipCache = isImageBuilder || isCucumberJob || !useCache;

  print('\n    ======================================\n');
  subtle('COMPRESS STEP');
  subtle('isImageBuilder', isImageBuilder);
  subtle('isCucumberJob', isCucumberJob);
  if (!skipCache) {
    subtle('cache directory', cacheDir);
    subtle('cache file', cacheFile);
  } else {
    subtle('skipping cache');
  }

  print('\n    ======================================\n');

  const cache = skipCache ? null : flatCache.load(cacheFile, cacheDir);

  let entries = Object.keys(manifest).reduce((seq, fName) => {
    const fileIsCSSorJSNotMinified = !fName.match(/\.map$/) && fName.match(/\.js$|\.css$/) && !fName.match(/\.min\./g);

    if (fileIsCSSorJSNotMinified) {
      const theFile = manifest[fName];
      const input = path.join(basePath, theFile);
      const inputMap = path.join(basePath, `${theFile}.map`);

      seq.push({
        target: fName,
        cmd: input.match(/\.css$/) ? 'csso' : 'uglifyjs',
        input,
        inputMap,
        output: input.replace(/((\.js)|(\.css))$/, '.min$1'),
        outputMap: inputMap.replace(/((\.js\.map)|(\.css\.map))$/, '.min$1'),
      });
    }

    return seq;
  }, []);

  entries = entries.map(async entry => {
    const cmd = entry.cmd;

    const theCMD =
      cmd === 'csso'
        ? `csso ${entry.input} -o ${entry.output} --comments exclamation` // --input-map ${entry.inputMap} --map ${entry.outputMap} // IGNORE MAP as we do have the map for non minimized version
        : `terser ${entry.input} -m -c dead_code,drop_debugger,sequences,properties,conditionals,comparisons,warnings=false,pure_funcs=['console.log','console.debug','console.trace'] -d __RED_PROD_MODE__='production' -d __REDUX_DEV_TOOLS__=false -o ${entry.output} --comments=/^!/`;

    const cacheKey = skipCache
      ? null
      : hasha(isCucumberJob ? await read(entry.input) : entry.input, {
          algorithm: 'md5',
        });

    cacheKey && subtle('cacheKey', cacheKey, 'for', entry.input);

    const savedMinifiedFile = skipCache ? null : cache.getKey(cacheKey); // never attempt to get the element from cache in image builder

    if (savedMinifiedFile) {
      success('cacheKey FOUND', cacheKey);
      await write(entry.output, savedMinifiedFile, { encoding: 'utf8' });
      success('Saving from cache', entry.output);
    } else {
      cacheKey && warn('cacheKey NOT FOUND', cacheKey);
      await execCommand(theCMD, { id: `compress ${entry.target}` });

      if (!skipCache) {
        const savedContent = await read(entry.output, { encoding: 'utf8' });
        if (savedContent) {
          subtle('Saving content to cache from', entry.input);
          cache.setKey(cacheKey, savedContent);
        }
      }
    }

    const beforeSize = await getSizeInMB(entry.input);
    const afterSize = await getSizeInMB(entry.output);

    return {
      cmd,
      input: entry.input,
      output: entry.output,
      beforeSize,
      afterSize,
      // the percentage of compression achieved
      ratio: round2(((beforeSize - afterSize) / beforeSize) * 100),
    };
  });

  const res = await Promise.all(entries);

  print('\n    ======================================\n');

  res.forEach(({ input, beforeSize, afterSize, ratio }) => {
    // print the info about how much compression was actually achieved
    success(`${input}`);
    subtle(`${beforeSize.toFixed(2)}MB => ${afterSize.toFixed(2)}MB ==> ${ratio.toFixed(2)}%\n`);
  });

  cache && cache.save();
  subtle('compress cache saved!');
  print('\n    ======================================\n');

  return timer.stop();
};

main()
  .then(({ diffFormatted }) => ok('compress done!, took:', diffFormatted))
  .catch(err => error(err.message));
