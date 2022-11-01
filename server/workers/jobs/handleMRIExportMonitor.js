/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { getMRIExportStats } from '../../dal/mri-export-repo';

const logger = loggerModule.child({ subType: 'MRIExportMonitor' });

const hasAtleastOneAlert = MRIExportStats => Object.values(MRIExportStats).find(stats => stats.length > 0);

export const handleMRIExportMonitor = async ctx => {
  logger.time({ ctx }, 'Recurring Jobs - Running MRIExportMonitor duration');

  logger.trace({ ctx }, 'Checking MRI export stats');
  const MRIExportStats = {
    moveinAlreadyScheduled: await getMRIExportStats(ctx, 'Movein already scheduled', '24 hours'),
  };

  const level = hasAtleastOneAlert(MRIExportStats) ? 'warn' : 'info';
  logger[level]({ ctx, MRIExportStats }, 'MRI export stats');

  logger.timeEnd({ ctx }, 'Recurring Jobs - Running MRIExportMonitor duration');
  return { processed: true };
};
