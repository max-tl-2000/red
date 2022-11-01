/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable */
const shouldSkip = require('../lib/should-skip-file-for-testcafe');

module.exports = {
  meta: {
    docs: {
      description: "disallow usage of `t.click` method",
      category: "Possible Errors",
      recommended: true
    }
  },
  create: (context) => {
    const fileName = context.getFilename();

    return {
      CallExpression: function(node) {
        if (shouldSkip(fileName)) return;

        if (node.callee.type === 'MemberExpression'
            && node.callee.property
            && node.callee.property.type === 'Identifier'
            && node.callee.property.name === 'click') {
          context.report({
            node: node.callee.property,
            message: 'Unexpected use of `t.click`. Use helpers `clickOnElement` instead'
          });
        }
      }
    };
  }
};
