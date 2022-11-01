/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createDBKnexInstanceWithCollector } from '../database/knex-query-collector';
import loggerInstance from '../../common/helpers/logger';

const logger = loggerInstance.child({ subType: 'dbKnexMiddleware' });

// little helper to ensure a fn is executed only once
const onlyOnce = fn => {
  let called = false;
  return (...args) => {
    if (!called) {
      called = true;
      fn(...args);
    }
  };
};

export const dbKnexMiddleware = config => (req, res, next) => {
  // TODO: set the header `x-reva-db-profiling-enabled` from the client side when the app is loaded with the ?dbProfiling=1 flag
  if (config.dbProfiling?.enabled || req.headers['x-reva-db-profiling-enabled'] === 'true') {
    let { dbKnex, dbKnexReadOnly, collector } = createDBKnexInstanceWithCollector(config.dbProfiling);

    req.dbKnex = dbKnex;
    req.dbKnexReadOnly = dbKnexReadOnly;

    // generate the report when the response ends
    const doReport = onlyOnce(() => {
      const report = collector.generateReport(req.dbKnex);
      const reportForReadOnly = collector.generateReport(req.dbKnexReadOnly);

      // TODO: check if we should log this to a file instead so we can have the entire set of queries info for further analysis
      logger.info({ path: req.path, reqId: req.reqId, ctx: req, report, reportForReadOnly }, 'db queries report');

      collector = null;
      req.dbKnex = dbKnex = null;
      req.dbKnexReadOnly = dbKnexReadOnly = null;
    });

    res.on('finish', doReport);
    res.on('close', doReport);
  }
  next();
};
