/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { emptyJsonbObj } from './helpers/common';

const logger = loggerModule.child({ subType: 'textExpansionContext' });

export const getExpansionContext = async (ctx, missingContextQueries) => {
  const queryStatements = Object.keys(missingContextQueries).reduce(
    (acc, key) => {
      const formattedKey = key.toLowerCase();
      acc.selectStatement = `${acc.selectStatement} result -> '${formattedKey}' as ${formattedKey},`;
      const contextQuerySelect =
        missingContextQueries[key] === emptyJsonbObj
          ? missingContextQueries[key]
          : `(SELECT array_agg(DISTINCT ${formattedKey}.*) FROM (${missingContextQueries[key]}) AS ${formattedKey})`;
      acc.fromStatement = `${acc.fromStatement} '${formattedKey}', ${contextQuerySelect},`;
      return acc;
    },
    { selectStatement: 'SELECT ', fromStatement: 'FROM json_build_object(' },
  );
  const selectStatementWithoutLastComma = queryStatements.selectStatement.slice(0, -1);
  const fromStatementWithoutLastComma = queryStatements.fromStatement.slice(0, -1);

  const finalQuery = `${selectStatementWithoutLastComma} ${fromStatementWithoutLastComma}) as result`;
  logger.info({ ctx, query: finalQuery.substring(0, 2500) }, 'Expansion Context Query');

  const { rows = [] } = await rawStatement(ctx, finalQuery);
  return rows;
};
