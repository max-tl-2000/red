/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getAllChangedFiles } from './git-helper';
export const getFilesThatChanged = async () => {
  const files = await getAllChangedFiles({ resolvePaths: false });

  const matchers = [/\/static\//, /\/client\//, /\/__tests__\//, /\/bin\//, /\/webpack\//, /\/resources\//, /tasks\.js$/, /\/cucumber\//];

  return files.filter(file => matchers.every(matcher => !file.match(matcher)) || file.match(/\.xlsx/));
};
