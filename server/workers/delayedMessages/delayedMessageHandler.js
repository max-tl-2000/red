/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveCustomMessageEvent } from '../../services/partyEvent';
import { getDelayedMessageById, updateDelayedMessageStatus } from '../../dal/delayedMessagesRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import loggerModule from '../../../common/helpers/logger';
import { runInTransaction } from '../../database/factory';
import { assert } from '../../../common/assert';

const logger = loggerModule.child({ subType: 'delayedMessages' });

export const processDelayedMessage = async req => {
  const { msgCtx, partyId, delayedMessageId } = req;
  logger.trace({ ctx: msgCtx, partyId, delayedMessageId }, 'Processing Delayed Message');
  const delayedMessageNotFound = 'Delayed message not found';

  try {
    await runInTransaction(async trx => {
      const innerCtx = { ...msgCtx, trx };

      let delayedMessage = await getDelayedMessageById(innerCtx, delayedMessageId);
      assert(delayedMessage, `processDelayedMessage: ${delayedMessageNotFound}: ${delayedMessageId}`);

      if (delayedMessage.status === DALTypes.DelayedMessageStatus.IGNORE) {
        logger.warn({ ctx: msgCtx, partyId, delayedMessageId, delayedMessageStatus: delayedMessage.status }, 'Ignoring delayed message');
        return;
      }

      delayedMessage = await updateDelayedMessageStatus(innerCtx, delayedMessageId, DALTypes.DelayedMessageStatus.PROCESSED);
      await saveCustomMessageEvent(innerCtx, {
        partyId,
        metadata: delayedMessage.message,
      });
    });
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'Processing delayed message failed');
    const processed = !!error?.message?.includes(delayedMessageNotFound);
    return { processed };
  }

  return { processed: true };
};
