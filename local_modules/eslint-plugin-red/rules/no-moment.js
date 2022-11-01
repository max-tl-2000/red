/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

module.exports = {
  meta: {
    docs: {
      description: 'disallow require/import moment',
      category: 'dangerous imports',
      recommended: true,
    },
  },
  create: context => ({
    CallExpression: node => {
      const momentRequire =
        node.callee.name === 'require' &&
        ((node.arguments[0] && node.arguments[0].value === 'moment') || (node.arguments[0] && node.arguments[0].value === 'moment-timezone'));

      if (momentRequire) {
        context.report(node, 'Do not require moment. Use methods from `moment-utils`.');
      }
    },
    ImportDeclaration: node => {
      const momentImport = node.source && node.source.type === 'Literal' && (node.source.value === 'moment' || node.source.value === 'moment-timezone');

      if (momentImport) {
        context.report(node, 'Do not import moment. Use methods from `moment-utils`.');
      }
    },
  }),
};
