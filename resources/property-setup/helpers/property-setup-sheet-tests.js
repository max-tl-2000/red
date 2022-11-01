/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import execCommand from '../../exec-command';
import { tryReadJSON } from '../../../common/helpers/xfs';

export const baseLinePropertySetupSheet = {
  id: '1JX2ksIRvl9EvjkJPjDVzY-MdgvnYPu-B8g_BI95pelU',
  name: 'Reva Sample.xlsx',
};

export const productionPropertySetupSheets = [
  {
    id: '1mNy6H4xLSFuw2NNMtI1col9eY4XRSud-YW-xFNKNauU',
    name: 'Maximus Prod - Cove+Serenity+Wood+Parkmerced+Sharon Green+Shore.xlsx',
  },
];

export const stagingPropertySetupSheets = [
  {
    id: '1iriO4a1cnkp43hiQwaBqyqJ3w7WU0VnFmfhrSrMVIco',
    name: 'Maximus Staging - Cove+Serenity+Wood+Parkmerced+Sharon Green+Shore.xlsx',
  },
  {
    id: '1Vw-VS6jQCwaPTgnfVPck8CugrdMFiq0JSsrjH_9pTY0',
    name: 'CUSTOMEROLD-SAL Staging - Dylan+Commons-Landing+Chateau+South Pointe+Plaza.xlsx',
  },
  {
    id: '1zVvbV7NAGLWKjAgnYRJaF9N3BuKwUJYJRDauQ3B3EP0',
    name: 'CUSTOMEROLD Staging - Commons-Landing+Chateau+South Pointe+Plaza.xlsx',
  },
];

export const importTestPropertySetupSheets = [baseLinePropertySetupSheet, ...stagingPropertySetupSheets];
export const allPropertySetupSheets = [baseLinePropertySetupSheet, ...productionPropertySetupSheets, ...stagingPropertySetupSheets];
export const DOWNLOADS_DIR = './.temp';
export const ERROR_EXIT_CODE = 1;
export const SUCCESS_EXIT_CODE = 0;
export const DOWNLOADED_GDRIVE_FILES_FILE_PATH = `${DOWNLOADS_DIR}/downloaded-gdrive-files.json`;
export const getSheetNameFromPath = sheetPath => path.basename(sheetPath);

const getDownloadSheetsCmd = fileIds => `./bnr google-drive-downloader --fileIds=${fileIds.join(',')}`;

export const downloadPropertySetupSheets = async fileIds => {
  if (!(await execCommand(getDownloadSheetsCmd(fileIds)))) throw Error('An error occured downloading the property setup sheets');
};

export const getDownloadedSheetPaths = async (options = {}) => {
  const { filterBaseLineSheet = false, baseLineSheetName = baseLinePropertySetupSheet.name } = options;
  const downloadedFiles = await tryReadJSON(DOWNLOADED_GDRIVE_FILES_FILE_PATH, {});

  const sheetPaths = downloadedFiles?.files?.map(({ fileId, filePath }) => ({ fileId, filePath })) || [];
  const baseLineSheetFilter = ({ filePath }) => !filePath.includes(baseLineSheetName);

  return filterBaseLineSheet ? sheetPaths.filter(baseLineSheetFilter) : sheetPaths;
};
