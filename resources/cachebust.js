/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { error, subtle, ok, success } from 'clix-logger/logger';
import { basename, dirname, resolve } from 'path';
import md5File from 'md5-file/promise';
import { readJSON, write } from '../common/helpers/xfs';
import { expand } from './expand';
import execp from './execp';
import trim from '../common/helpers/trim';

const isMac = process.platform === 'darwin';

const stampIt = (fileName, md5Stamp) => {
  const regex = /(.+)\.(\w+)$/gi;
  return fileName.replace(regex, `$1_${md5Stamp}.$2`);
};

// directoryOfManifestFile, currentAsset, currentAssetHasSourceMap, dryRun
const processFile = async ({ directoryOfManifestFile, asset, assetHasSourceMap, dryRun }) => {
  const assetAbsolutePath = resolve(directoryOfManifestFile, asset);

  let md5Stamp = await md5File(assetAbsolutePath);

  md5Stamp = trim(md5Stamp);

  // side effects start from this point on...
  const assetNewFileName = stampIt(asset, md5Stamp);
  const resolvedFileNameWithHash = resolve(directoryOfManifestFile, assetNewFileName);

  const mvCommand = `mv '${assetAbsolutePath}' '${resolvedFileNameWithHash}'`;

  subtle('Add hash to the file:\n');
  subtle('   ', mvCommand, '\n');

  if (!dryRun) {
    await execp(mvCommand);
  }

  ok('hash added to file', resolvedFileNameWithHash);

  if (assetHasSourceMap) {
    const mvMapCommand = `mv '${assetAbsolutePath}.map' '${resolvedFileNameWithHash}.map'`;

    subtle('Rename source map file');
    subtle('    ', mvMapCommand);

    if (!dryRun) {
      await execp(mvMapCommand);
    }
    ok('Source map renamed');

    const sedCommand = `sed -i ${isMac ? " '' -e " : ''} '$ s/${asset}.map/${assetNewFileName}.map/g' '${resolvedFileNameWithHash}'`;

    subtle('Add source map mapping to the file:', resolvedFileNameWithHash);
    subtle('    ', sedCommand);

    if (!dryRun) {
      await execp(sedCommand);
    }
    ok('Mapping added to file', resolvedFileNameWithHash);
  }

  return {
    assetNewFileName,
    assetNewSourceMapFileName: `${assetNewFileName}.map`,
  };
};

const processManifest = async ({ manifestFilePath, dryRun }) => {
  const absolutePathOfManifestFile = resolve(manifestFilePath);
  const directoryOfManifestFile = dirname(absolutePathOfManifestFile);
  const manifestFileNamePartOnly = basename(absolutePathOfManifestFile);

  subtle('Processing...', manifestFileNamePartOnly);

  const content = await readJSON(manifestFilePath);
  // the manifestFile contains an object which keys map to the real name of the assets
  const assets = Object.keys(content);

  for (let i = 0; i < assets.length; i++) {
    const baseAssetName = assets[i];
    const currentAsset = content[baseAssetName];

    // other assets are not affected by the webpack bug
    if (!currentAsset.match(/\.js$|\.css$/)) continue; // eslint-disable-line

    const nameOfSourceMapForCurrentAsset = `${currentAsset}.map`;
    const currentAssetHasSourceMap = content[nameOfSourceMapForCurrentAsset];

    const { assetNewFileName, assetNewSourceMapFileName } = await processFile({
      directoryOfManifestFile,
      asset: currentAsset,
      assetHasSourceMap: currentAssetHasSourceMap,
      dryRun,
    });

    if (currentAssetHasSourceMap) {
      content[nameOfSourceMapForCurrentAsset] = assetNewSourceMapFileName;
    }

    content[baseAssetName] = assetNewFileName;
  }

  const serializedContent = JSON.stringify(content, null, 2);

  subtle('writing new', manifestFilePath, '...');

  if (!dryRun) {
    await write(manifestFilePath, serializedContent);
  } else {
    subtle('content to write', serializedContent);
  }
  ok('manifest created', manifestFilePath);
};

const processManifestFiles = async (manifests, dryRun) => {
  for (let i = 0; i < manifests.length; i++) {
    const manifestFilePath = manifests[i];
    await processManifest({ manifestFilePath, dryRun });
  }
};

export const bustCache = async (manifestsGlobs, { dryRun } = {}) => {
  subtle('Cache bust process start...');

  const manifests = await expand({ patterns: manifestsGlobs });

  try {
    await processManifestFiles(manifests, dryRun);
  } catch (ex) {
    error('bustCache error', ex);
  }

  success('Cache bust process done.');
};
