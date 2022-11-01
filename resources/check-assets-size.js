/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { subtle, error, success, ok } from 'clix-logger/logger';
import { basename, dirname, resolve } from 'path';
import textTable from 'text-table';
import flatCache from 'flat-cache';
import chalk from 'chalk';
import { expand } from './expand';
import { readJSON, stat, write } from '../common/helpers/xfs';
import { getCacheFolder } from './get-cache-folder';
import nullish from '../common/helpers/nullish';

const round2 = num => (+`${Math.round(`${num}e+2`)}e-2`).toFixed(2);

const processAsset = async (assetName, realAssetName, dir) => {
  const { size } = await stat(resolve(dir, realAssetName));
  return { asset: assetName, size: size / 1024 };
};

const addMin = file => file.replace(/((\.js|\.css))$/, '.min$1');

const processManifest = async (manifestFilePath, minOnly) => {
  const absolutePathOfManifestFile = resolve(manifestFilePath);
  const directoryOfManifestFile = dirname(absolutePathOfManifestFile);
  const manifestFileNamePartOnly = basename(absolutePathOfManifestFile);

  subtle('Processing...', manifestFileNamePartOnly);

  const content = await readJSON(manifestFilePath);
  let assets = Object.keys(content).filter(currentAsset => currentAsset.match(/\.js$|\.css$/));

  // hack to add the minified versions
  assets = assets.reduce(
    (acc, asset) => {
      const resolvedAsset = content[asset];
      const minKey = addMin(asset);

      // create the key entry for minimized resource
      content[minKey] = addMin(resolvedAsset);

      // push the key to the assets
      acc.push(minKey);
      return acc;
    },
    minOnly ? [] : assets,
  );

  return {
    manifest: manifestFileNamePartOnly,
    stats: await Promise.all(assets.map(asset => processAsset(asset, content[asset], directoryOfManifestFile))),
  };
};

const processManifestFiles = async (manifests, minOnly) => {
  const promises = manifests.map(entry => processManifest(entry, minOnly));
  let results = await Promise.all(promises);

  results = results.reduce(
    (acc, manifest) => {
      const { manifestAssets } = manifest.stats.reduce(
        (seq, _stat) => {
          seq.manifestAssets.push(_stat);
          return seq;
        },
        { manifestAssets: [] },
      );

      acc.assets = acc.assets.concat(manifestAssets);
      return acc;
    },
    { assets: [] },
  );

  return results;
};

const getCache = () => {
  const cacheDir = getCacheFolder('assets-size');
  const cache = flatCache.load('sizesCache', cacheDir);

  return cache;
};

const createComparerSource = async fileToCompare => {
  const cache = getCache();

  let compareSource;
  if (fileToCompare) {
    if (typeof fileToCompare !== 'string') {
      throw new TypeError(`fileToCompare must be a string. Received: ${fileToCompare}`);
    }
    compareSource = fileToCompare ? (await readJSON(fileToCompare)) || {} : {};
  }

  return {
    compareSource,
    getKey(file) {
      if (fileToCompare) return compareSource[file];
      return cache.getKey(file);
    },
    setKey(file, contents) {
      cache.setKey(file, contents);
    },
    save() {
      cache.save();
    },
  };
};

const getArrow = diff => {
  if (diff > 0) return '⬆';
  if (diff < 0) return '⬇';
  return '-';
};

const getMethod = diff => {
  if (diff > 0) return 'red';
  if (diff < 0) return 'green';
  return 'white';
};

const getStats = (rows, sizeField) =>
  rows.reduce(
    (acc, row) => {
      const field = row.asset.match(/\.js$/) ? 'jsSize' : 'cssSize';

      acc[field] += row[sizeField] || 0;
      acc.total += row[sizeField] || 0;

      return acc;
    },
    { total: 0, cssSize: 0, jsSize: 0 },
  );

const units = {
  KB: { unit: 'KB', factor: 1 },
  MB: { unit: 'MB', factor: 1024 },
};

const printAsTable = (results, { compare, unit: _unit, diffPercentages } = {}) => {
  const { unit = 'KB', factor = 1 } = units[_unit] || {};

  let headers = [chalk.yellow('Name'), chalk.yellow(`Size (${unit})`)];
  let align = ['l', 'r'];

  if (compare) {
    headers = [chalk.yellow(' '), ...headers, chalk.yellow(`Prev (${unit})`), chalk.yellow(`Diff (${diffPercentages ? '%' : unit})`)];
    align = ['c', ...align, 'r', 'r'];
  }

  console.log(
    '\n',
    textTable(
      [
        headers,
        ...results.assets
          .sort((a, b) => (a.asset > b.asset ? 1 : -1))
          .map(entry => {
            const method = getMethod(entry.diff);
            let rec = [chalk[method](entry.asset), chalk[method](round2(entry.size / factor))];
            if (compare) {
              const diff = diffPercentages ? (entry.diff / entry.oldSize) * 100 : entry.diff;

              rec = [
                chalk[method](nullish(entry.diff) ? '--' : getArrow(entry.diff)),
                ...rec,
                chalk[method](nullish(entry.oldSize) ? '--' : round2(entry.oldSize / factor)),
                chalk[method](nullish(diff) || !Number.isFinite(diff) ? '--' : round2(diff)),
              ];
            }
            return rec;
          }),
      ],
      { align },
    ),
    '\n',
  );

  const stats = getStats(results.assets, 'size');
  const resultData = [
    [' ', 'Total   ', 'css   ', 'js   '].map(entry => chalk.yellow(entry)),
    ['Current sizes', stats.total / factor, stats.cssSize / factor, stats.jsSize / factor].map(entry => {
      if (typeof entry === 'number') {
        entry = `${round2(entry)} ${unit}`;
      }
      return chalk.white(entry);
    }),
  ];

  if (compare) {
    const prevStats = getStats(results.assets, 'oldSize');
    resultData.push(
      ['Previous sizes', prevStats.total / factor, prevStats.cssSize / factor, prevStats.jsSize / factor].map(entry => {
        if (typeof entry === 'number') {
          entry = `${round2(entry)} ${unit}`;
        }
        return chalk.white(entry);
      }),
      [
        'Diff',
        diffPercentages ? ((stats.total - prevStats.total) / prevStats.total) * 100 : stats.total - prevStats.total,
        diffPercentages ? ((stats.cssSize - prevStats.cssSize) / prevStats.cssSize) * 100 : stats.cssSize - prevStats.cssSize,
        diffPercentages ? ((stats.jsSize - prevStats.jsSize) / prevStats.jsSize) * 100 : stats.jsSize - prevStats.jsSize,
      ].map(entry => {
        if (typeof entry === 'number') {
          const isGreater = entry > 0;
          const isLower = entry < 0;

          let symbol = '';

          if (isLower) symbol = '⬇';
          if (isGreater) symbol = '⬆';

          entry = `${symbol} ${round2(entry)}  ${diffPercentages ? '%' : unit}`;

          if (isLower) return chalk.green(entry);
          if (isGreater) return chalk.red(entry);
        }

        return chalk.white(entry);
      }),
    );
  }

  console.log(textTable(resultData, { align: ['l', 'r', 'r', 'r'] }), '\n');
};

const _checkAssetsSize = async (
  manifestsGlobs,
  { compareToBaseline, createBaseline = false, compareToFile, json, unit = 'KB', diffPercentages, minOnly } = {},
) => {
  subtle('[checkAssetsSize] start...');

  const manifests = await expand({ patterns: manifestsGlobs });
  const comparerSource = await createComparerSource(compareToFile);
  const compare = compareToBaseline || compareToFile;

  try {
    const results = await processManifestFiles(manifests, minOnly);

    if (compare) {
      results.assets = results.assets.map(entry => {
        const { asset, size } = entry;
        let { size: oldSize } = comparerSource.getKey(asset) || {};

        if (nullish(oldSize)) {
          oldSize = 0;
        }

        const diff = size - oldSize;

        return { ...entry, oldSize, diff };
      });
    }

    if (createBaseline) {
      results.assets.forEach(({ asset, size }) => {
        comparerSource.setKey(asset, { size });
      });
      comparerSource.save();
      ok('Saving baseline');
    }

    if (json) {
      if (typeof json !== 'string') {
        throw new TypeError(`json must be a string. Received: ${json}`);
      }
      const serialized = results.assets.reduce((acc, { asset, size }) => {
        acc[asset] = { size };
        return acc;
      }, {});
      await write(json, JSON.stringify(serialized, null, 2));
      ok(`File "${json}" created`);
    } else {
      printAsTable(results, { compare, unit, diffPercentages });
    }
  } catch (ex) {
    error('[checkAssetsSize] error', ex);
  }

  success('[checkAssetsSize] done.');
};

export const checkAssetsSize = (...args) => _checkAssetsSize(...args).catch(error);
