/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import Promise from 'bluebird';
import loggerModule from '../helpers/logger';
import { deferred } from '../helpers/deferred';

const logger = loggerModule.child({ subType: 'zipUtils' });
const zipErrorMessage = 'Error zipping file';

const getZipFilePath = fileToZipPath => ({
  zipFilePath: path.join(path.dirname(fileToZipPath), `${path.basename(fileToZipPath)}.zip`),
  zipFileName: `${path.basename(fileToZipPath)}.zip`,
});

export const zipFile = (fileToZipPath, zipFileName, archivedFileName) =>
  new Promise((resolve, reject) => {
    const { zipFilePath, zipFileName: zippedFileName } = getZipFilePath(fileToZipPath);

    const finalZipFileName = zipFileName || zippedFileName;
    const finalZipFilePath = (zipFileName && `${path.dirname(zipFilePath)}/${finalZipFileName}`) || zipFilePath;
    const finalFileToZipName = archivedFileName || path.basename(fileToZipPath);
    const output = fs.createWriteStream(finalZipFilePath);
    const zip = archiver('zip', {
      zlib: { level: 9 },
    });

    zip.on('error', error => {
      logger.error({ error }, zipErrorMessage);
      reject(error);
    });

    zip.pipe(output);

    output.on('close', () => {
      resolve({ zipFilePath: finalZipFilePath, zipFileName: finalZipFileName, fileToZipPath });
    });

    zip.append(fs.createReadStream(fileToZipPath), { name: finalFileToZipName });

    zip.finalize();
  }).catch(error => {
    logger.error({ error }, zipErrorMessage);
    throw error;
  });

export const extractZipFile = async (zipFilePath, outputFilePath) => {
  const dfd = deferred();
  fs.createReadStream(zipFilePath)
    .pipe(unzipper.Extract({ path: outputFilePath })) // eslint-disable-line new-cap
    .promise()
    .then(
      () => dfd.resolve(),
      e => dfd.reject(e),
    );
  return dfd;
};
