/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { mapSeries } from 'bluebird';

import fs from 'fs';
import klaw from 'klaw';
import unzipper from 'unzipper';
import sharp from 'sharp';
import loggerModule from './logger';
import { deferred } from './deferred';
import { NO_IMAGE_RESIZE } from '../enums/enums';
import { write, mkdirp } from './xfs';

const logger = loggerModule.child({ subType: 'uploadUtils' });

const sharpSupportedFileExtensions = ['.gif', '.jpg', '.jpeg', '.tiff', '.png', '.svg', '.webp'];

const resizeImage = async (ctx, file, imageSize) => {
  const dfd = deferred();

  logger.debug({ ctx, file }, 'resizing image start');

  const assetReadStream = file.stream();
  const pipeline = sharp();

  pipeline
    .resize(imageSize, imageSize, { withoutEnlargement: true, fit: sharp.fit.inside })
    .toBuffer()
    .then(
      buffer => dfd.resolve(buffer),
      e => {
        logger.error({ ctx, err: e, file, imageSize }, 'Error on resizing the image');
        dfd.reject(e);
      },
    );

  assetReadStream.pipe(pipeline);
  logger.debug({ ctx, file }, 'resizing image done');

  return dfd;
};

const processArchiveEntry = async (ctx, file, { outputFolder, allowedExtensions, isImageContent, imageSize, emptyDirectories }) => {
  const { path: fileName, type: fileType } = file;
  const ext = path.extname(fileName);
  if (fileType !== 'Directory' && (!ext || !allowedExtensions.includes(ext.toLowerCase()))) {
    logger.warn({ ctx }, `Extension "${ext}" is not allowed. ${fileName}`);
    return;
  }

  const newFilePath = path.join(outputFolder, fileName);
  logger.debug({ ctx, file: newFilePath }, 'processing file start');

  if (fileType === 'File') {
    let result;

    if (isImageContent && imageSize !== NO_IMAGE_RESIZE && sharpSupportedFileExtensions.includes(ext.toLowerCase())) {
      result = await resizeImage(ctx, file, imageSize);
    }

    if (result) {
      await write(newFilePath, result);
    } else {
      const dir = path.dirname(newFilePath);
      await mkdirp(dir);
      await file.stream().pipe(fs.createWriteStream(newFilePath));
    }

    Object.keys(emptyDirectories).forEach(d => {
      if (fileName.includes(d)) {
        emptyDirectories[d] = undefined;
      }
    });

    logger.debug({ ctx, file: newFilePath }, 'processing file done');
  } else {
    emptyDirectories[fileName] = true;
  }
};

export const extractAllowedFilesFromArchive = async (ctx, archivePath, outputFolder, { isImageContent, imageSize, allowedExtensions }) => {
  logger.debug({ ctx }, `Extracting archive ${archivePath} to ${outputFolder}`);
  const emptyDirectories = {};

  const directory = await unzipper.Open.file(archivePath);

  await mapSeries(directory.files, async file => {
    await processArchiveEntry(ctx, file, { outputFolder, allowedExtensions, isImageContent, imageSize, emptyDirectories });
  });

  return { emptyDirectories: Object.keys(emptyDirectories).filter(key => emptyDirectories[key]) };
};

export const getUploadedFiles = async uploadFolder => {
  const files = [];

  await new Promise((resolve, reject) => {
    klaw(uploadFolder)
      .on('data', item => {
        if (!item.stats.isDirectory()) files.push(item.path);
      })
      .on('error', (err, item) => {
        logger.error({ err, filePath: item.path }, 'Error getting uploaded file');
        reject(err);
      })
      .on('end', () => resolve());
  });

  logger.info({ totalFiles: files.length }, '[getUploadedFiles] files');
  return files;
};
