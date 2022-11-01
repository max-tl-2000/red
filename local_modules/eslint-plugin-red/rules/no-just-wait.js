/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable */
const shouldSkip = require('../lib/should-skip-file-for-cucumber');

module.exports = {
  meta: {
    docs: {
      description: "disallow unnecessary justWait calls",
      category: "Possible Errors",
      recommended: true
    }
  },
  create: (context) => {
    const fileName = context.getFilename();

    return {
      CallExpression: function(node) {
        if (shouldSkip(fileName)) return;

        if (node.callee.name === 'justWait') {
          context.report({
            node: node.callee,
            message: 'Unexpected use of `' + node.callee.name + '`. Prefer an approach that does not use waiting times'
          });
        }
      }
    };
  }
};
