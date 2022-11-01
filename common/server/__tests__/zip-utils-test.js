/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { promisify } from 'bluebird';
import { expect } from 'test-helpers';
import fs from 'fs';
import { zipFile, extractZipFile } from '../zip-utils';

const writeFile = promisify(fs.writeFile);
const deleteFile = promisify(fs.unlink);
const fileExists = promisify(fs.stat);
const zipFilePath = `${__dirname}/test.txt.zip`;
const fileToZipPath = `${__dirname}/test.txt`;

describe('zipFile()', () => {
  beforeEach(async () => {
    await writeFile(fileToZipPath, 'File with some text.');
  });

  afterEach(async () => {
    await deleteFile(fileToZipPath);
    await deleteFile(zipFilePath);
  });

  describe('given a file', () => {
    it('should add the file to a zipped archived', async () => {
      const { zipFilePath: zipPath, fileToZipPath: zippedFiledPath } = await zipFile(fileToZipPath);

      expect(zipPath).to.equal(zipFilePath);
      expect(zippedFiledPath).to.equal(fileToZipPath);

      const zippedFileExists = await fileExists(zipPath);
      expect(zippedFileExists).to.not.be.null;
    });
  });

  describe('given a zipped file', () => {
    it('should extract the zipped archived', async () => {
      const { zipFilePath: zippedFilePath } = await zipFile(fileToZipPath);
      await deleteFile(fileToZipPath);

      await extractZipFile(zippedFilePath, __dirname);

      const extractedFileExists = await fileExists(fileToZipPath);
      expect(extractedFileExists).to.not.be.null;
    });
  });
});
