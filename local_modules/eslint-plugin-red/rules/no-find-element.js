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
      description: "disallow usage of `webdriver.findElement`/`webdriver.findElements` method",
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
            && node.callee.object
            && node.callee.object.type !== 'ThisExpression'
            && node.callee.property
            && node.callee.property.type === 'Identifier') {
          if (node.callee.property.name === 'findElement') {
            context.report({
              node: node.callee.property,
              message: 'Unexpected use of `webdriverElement.findElement`. Use BasePage `findElement(selector, ctx)` instead'
            });
          }
          if (node.callee.property.name === 'findElements') {
            context.report({
              node: node.callee.property,
              message: 'Unexpected use of `webdriverElement.findElements`. Use BasePage `findElements(selector, ctx)` instead'
            });
          }

        }
      }
    };
  }
};
