/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import path from 'path';
import temp from 'temp';
import { excelHandlerMixin } from '../converters/excelHandlerMixin';
import { toArrayBuffer } from '../../../common/helpers/strings';
import loggerModule from '../../../common/helpers/logger';
import { getS3Provider } from '../../workers/upload/s3Provider';
import { getKeyPrefixForExportedDatabase } from '../../workers/upload/uploadUtil';

const logger = loggerModule.child({ subType: 'fileConverter' });

export const uploadWorkbookToS3 = async (ctx, filePath, fileName) =>
  await getS3Provider().uploadResultsFile(ctx, fileName, filePath, getKeyPrefixForExportedDatabase, { zip: false });

export const createExcelFile = (baseFilePath = '', sheetNames = []) => {
  const target = {
    eventHandler: {},
    on: (event, cb) => {
      target.eventHandler[event] = cb;
      return target.eventHandler[event];
    },
  };
  const mixin = excelHandlerMixin();
  mixin(target);
  return target.createOrUseWorkbook(baseFilePath, sheetNames);
};

export const saveWorkbook = async (workbookObject, directory, fileName) => {
  try {
    temp.track();
    return new Promise((resolve, reject) => {
      temp.mkdir(directory, (tempErr, tempDir) => {
        if (tempErr) reject(tempErr);
        const convertedFilePath = path.join(tempDir, fileName);
        fs.appendFile(convertedFilePath, Buffer.from(toArrayBuffer(workbookObject)), fsErr => {
          if (fsErr) reject(fsErr);
          resolve(convertedFilePath);
        });
      });
    });
  } catch (err) {
    logger.error(err, 'Error trying to save workbook');
    return null;
  }
};
