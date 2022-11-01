/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../../common/helpers/env-val';

module.exports = {
  messageRetryDelay: 5000, // it's not read from ENV as we can't change the queue declaration after it's created
  defaultConsumersPerQueue: 5, // number of consumers per queue
  defaultCleanTenantsAfterInactivity: 1,
  dbProfiling: {
    longReport: envVal('REVA_DB_PROFILING_LONG_REPORT', true),
    logMissingKnexInCtx: envVal('REVA_DB_PROFILING_LOG_MISSING_KNEX_IN_CTX', true),
  },
};
