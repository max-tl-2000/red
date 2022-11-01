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
      MemberExpression: (node) => {
        if (shouldSkip(fileName)) return;

        if (node.object && node.object.type === 'ThisExpression' && node.property && node.property.name === 'driver') {
          context.report({
            node: node,
            message: 'Unexpected use of `this.driver`. Use BasePage methods instead'
          });
        }
      },
      CallExpression: (node) => {
        if (shouldSkip(fileName)) return;

        if (node.callee && node.callee.type === 'MemberExpression') {
          if (node.callee.object) {
            if (node.callee.object.type === 'Identifier'
                && node.callee.object.name === 'driver') {
              context.report({
                node: node,
                message: 'Unexpected use of `driver`. Use BasePage methods instead'
              });
            }

            if (node.callee.object.type === 'ThisExpression'
                && node.callee.property) {
              if (node.callee.property.name === 'byCSS') {
                context.report({
                  node: node,
                  message: 'Unexpected use of `this.byCSS`. All BasePage methods now use css selectors by default'
                });
              }

              if (node.callee.property.name === 'byXPath') {
                context.report({
                  node: node,
                  message: 'Unexpected use of `this.byXPath`. All BasePage methods now use css selectors by default'
                });
              }

              if (node.callee.property.name === 'byId') {
                context.report({
                  node: node,
                  message: 'Unexpected use of `this.byId`. All BasePage methods now use css selectors by default'
                });
              }
            }
          }
        }
      }
    };
  }
};
