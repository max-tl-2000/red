/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { DALTypes } from '../../../common/enums/DALTypes';
import { updateStatusForUsers } from '../../services/users';
import { insertLogoutUserStatusHistory } from '../../dal/usersRepo';
import { unlockAgentsForCallQueue } from '../../dal/teamsRepo';
import { NoRetryError } from '../../common/errors';
import { notify } from '../../../common/server/notificationClient';
import { runInTransaction } from '../../database/factory';
import eventTypes from '../../../common/enums/eventTypes';
import { loadUsers } from '../../api/actions/users';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'jobs' });

export const markUsersUnavailable = async payload => {
  const { msgCtx: ctx } = payload;

  try {
    logger.time({ ctx, payload }, 'Recurring Jobs - Mark users as unavailable');
    await runInTransaction(async trx => {
      const innerCtx = { ...ctx, trx };

      const users = await loadUsers(innerCtx);
      const allUserIds = users.map(u => u.id);
      const activeUserIds = users.filter(user => user.metadata.status !== DALTypes.UserStatus.NOT_AVAILABLE).map(user => user.id);
      await updateStatusForUsers(innerCtx, activeUserIds, DALTypes.UserStatus.NOT_AVAILABLE);
      await mapSeries(activeUserIds, async userId => await insertLogoutUserStatusHistory(innerCtx, userId));

      // sometimes the flag lockedForCallQueueRouting is never reset, so we need to make sure we reset it at midnight
      await unlockAgentsForCallQueue(innerCtx, allUserIds);

      logger.info({ ctx: innerCtx }, 'Forcing all users logout.');

      await notify({
        ctx: innerCtx,
        event: eventTypes.FORCE_LOGOUT,
        routing: { users: allUserIds },
      });
    });
  } catch (error) {
    const msg = 'Error while marking users as unavailable.';
    logger.error({ ctx, error, payload }, msg);
    throw new NoRetryError(msg);
  }
  logger.timeEnd({ ctx, payload }, 'Recurring Jobs - Mark users as unavailable');

  return { processed: true };
};
