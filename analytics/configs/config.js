/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

module.exports = {
  analyticsJobs: [
    {
      jobGroup: 'RESTARTMART',
      fileName: 'L3_drop.sql',
      jobName: 'L3_DROP',
      sequenceNumber: 1,
    },
    {
      jobGroup: 'RESTARTMART',
      fileName: 'L3_DDL.sql',
      jobName: 'L3_DDL',
      sequenceNumber: 10,
    },
    {
      jobGroup: 'LOADMART',
      fileName: 'L3_load_dimensions.sql',
      jobName: 'L3_LOAD_DIMENSIONS',
      sequenceNumber: 80,
    },
    {
      jobGroup: 'LOADMART',
      fileName: 'L3_load_facts.sql',
      jobName: 'L3_LOAD_FACTS',
      sequenceNumber: 81,
    },
  ],
};
