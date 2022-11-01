/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

module.exports = {
  meta: {
    docs: {
      description: 'disallow require/import lodash',
      category: 'dangerous imports',
      recommended: true,
    },
  },
  create: context => ({
    CallExpression: node => {
      const requiredLodash = node.callee.name === 'require' && node.arguments[0] && node.arguments[0].value === 'lodash';

      if (requiredLodash) {
        context.report(node, 'Do not require full lodash. Require specific lodash modules that you need.');
      }
    },
    ImportDeclaration: node => {
      const importedLodash = node.source && node.source.type === 'Literal' && node.source.value === 'lodash';

      if (importedLodash) {
        context.report(node, 'Do not require full lodash. Import specific lodash modules that you need.');
      }
    },
  }),
};
