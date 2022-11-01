/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * @fileoverview Rule to force the DAL methods to be async to prevent knex bugs
 * @author Toru Nagashima
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Force methods exported from the DAL layer to be async',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    let scope = null;

    const enterFunction = () => {
      scope = {
        upper: scope,
        hasAccessToDBMethods: false,
      };
    };

    const exitFunction = node => {
      let hasAccessToDBMethods = false;
      if (scope) {
        hasAccessToDBMethods = scope.hasAccessToDBMethods;
        scope = scope.upper;
      }

      if (!node.async && hasAccessToDBMethods) {
        context.report({
          node,
          message: 'Function should be async and use await to force knex to execute the queries',
        });
      }
    };

    return {
      CallExpression: node => {
        if (!node.callee) return;

        const factoryMethods = [
          // the commented ones are already being awaited
          // 'upsert',
          // 'insertInto',
          // 'update',
          // 'updateOne',
          // 'allIdExists',
          // 'exists',
          // 'getOne',
          // 'getAllWhere',
          // 'getAllWhereIn',
          // 'insertOrUpdate',
          // 'updateJSONBField',
          // 'saveMetadata',
          'withValidatedSchema',
          'initQuery',
        ];

        const str = sourceCode.getText(node);
        const hasAccessToDBmethods =
          (node.callee.type === 'Identifier' && factoryMethods.includes(node.callee.name)) ||
          str.match(/^knex\(/) ||
          str.match(/^knex\.withSchema\(/) ||
          str.match(/^knex.raw\(/);

        if (scope && hasAccessToDBmethods) {
          scope.hasAccessToDBMethods = true;
        }
      },
      ArrowFunctionExpression: enterFunction,
      FunctionExpression: enterFunction,
      FunctionDeclaration: enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,
      'FunctionExpression:exit': exitFunction,
      'FunctionDeclaration:exit': exitFunction,
    };
  },
};
