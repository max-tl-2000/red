/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';

const config = {
  aptexx: {
    // TODO: This properties might change, this is why they are the same as production right now
    testHostname: envVal('APTEXX_HOSTNAME', 'test-api.aptx.cm'),
    productionHostname: envVal('APTEXX_HOSTNAME', 'api.aptx.cm'),
    apiKey: envVal('APTEXX_KEY', '5JKODTU87WN74ALE'),
  },
  fullStory: {
    org: envVal('FULLSTORY_ORG', ''),
  },
  dbProfiling: {
    longReport: envVal('REVA_DB_PROFILING_LONG_REPORT', true),
    logMissingKnexInCtx: envVal('REVA_DB_PROFILING_LOG_MISSING_KNEX_IN_CTX', true),
  },
};

module.exports = config;
