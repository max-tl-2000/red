/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { fetchAndStoreTransactions } from '../../services/payment';
import loggerModule from '../../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'Payment Transactions Handler' });

export const processTransactions = async ctx => {
  logger.time({ ctx }, 'Recurring Jobs - Fetch and store transactions duration');

  await fetchAndStoreTransactions(ctx);

  logger.timeEnd({ ctx }, 'Recurring Jobs - Fetch and store transactions duration');

  return { processed: true };
};
