/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import execp from './execp';

/**
 * update the path of the current process with the npm bin path
 * this allows node commands installed in node_modules to be
 * executed without specifying the path to the commands
 */
export const updatePATH = async () => {
  const npmBin = await execp('npm bin');
  process.env.PATH += `${path.delimiter}${npmBin.trim()}`;
};
