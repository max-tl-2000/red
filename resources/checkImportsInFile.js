/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import memoize from 'lodash/memoize';
import { es6 } from '@royriojas/get-exports-from-file';
import { expand } from './expand';

const getImportsAndExportsInFile = memoize(async file => {
  try {
    return await es6(file);
  } catch (error) {
    return { error, exported: [], imported: [] };
  }
});

const isDepInFile = memoize(
  async (file, exportedName) => {
    const { exported, error } = await getImportsAndExportsInFile(file);
    if (error) {
      throw error;
    }
    return !!exported.find(dep => dep.name === exportedName);
  },
  (file, exportedName) => `${file}_${exportedName}`,
);

export const checkImportsInFile = async file => {
  const { imported, error } = await getImportsAndExportsInFile(file);
  if (error) {
    throw error;
  }

  const missingDeps = [];

  const dir = path.dirname(file);

  for (let i = 0; i < imported.length; i++) {
    const importedDep = imported[i];

    const { name, module, type, nodeType } = importedDep;

    if (!module) {
      console.log('****', file, importedDep, nodeType);
    }

    if (type === 'ImportNamespaceSpecifier' || type === 'ImportDefaultSpecifier' || !module.match(/^\./)) {
      continue; // eslint-disable-line
    }

    let resolvedModule = path.resolve(dir, module);

    if (!resolvedModule.match(/\.js$|\.ts$/)) {
      resolvedModule = [`${resolvedModule}.js`, `${resolvedModule}.ts`];
    }

    const resModule = await expand({ patterns: Array.isArray(resolvedModule) ? resolvedModule : [resolvedModule] });

    resModule.forEach(async modulePath => {
      const foundDep = await isDepInFile(modulePath, name);

      if (!foundDep) {
        missingDeps.push({ dep: name, module: modulePath, from: file });
      }
    });
  }

  return missingDeps;
};
