/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getFilesThatChanged } from '../changes-detector';

const main = async () => {
  const files = await getFilesThatChanged();
  process.stdout.write(files.length > 0 ? 'CHANGED' : 'NOT_CHANGED');
};

main().catch(err => console.error(err));
