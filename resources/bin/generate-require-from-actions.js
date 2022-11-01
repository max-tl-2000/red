/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { es6 } from '@royriojas/get-exports-from-file';
import { resolve } from 'path';
import { write } from '../../common/helpers/xfs';

const generateMapFromActionsIndex = async (indexFile, output) => {
  const exportsInActionIndex = (await es6(indexFile)).exported.reduce((acc, exported) => {
    acc[exported.name] = { module: exported.module, localName: exported.localName, default: exported.default };
    return acc;
  }, {});

  await write(output, JSON.stringify(exportsInActionIndex, null, 2));
};

const main = async () => {
  await generateMapFromActionsIndex(resolve('server/api/actions/index.js'), resolve('server/api/actions/generated-actions-requires.json'));
  await generateMapFromActionsIndex(resolve('rentapp/server/api/actions/index.js'), resolve('rentapp/server/api/actions/generated-actions-requires.json'));
  await generateMapFromActionsIndex(resolve('roommates/server/api/actions/index.js'), resolve('roommates/server/api/actions/generated-actions-requires.json'));
  await generateMapFromActionsIndex(resolve('resident/server/api/actions/index.js'), resolve('resident/server/api/actions/generated-actions-requires.json'));
};

main().catch(err => console.error(err));
