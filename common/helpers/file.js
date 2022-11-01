/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fs from 'fs';
import tryParse from './try-parse';
import { read } from './xfs';

export const readJSONFile = setting => {
  const stream = fs.readFileSync(setting.filePath, { encoding: 'utf8' });
  const recordFile = { rec: tryParse(stream, {}) };
  return recordFile;
};

export const readFileAsString = async (path, BASE_PATH) => {
  const fullPath = BASE_PATH.concat(path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File "${fullPath}" does not exist`);
  }
  return (await read(BASE_PATH.concat(path), { encoding: 'utf8' })).toString();
};
