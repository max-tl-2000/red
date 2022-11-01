/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { insertInto, rawStatement } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';

export const saveDelayedMessage = async (ctx, partyId, messageData) => {
  const delayedMessage = {
    id: newId(),
    status: DALTypes.DelayedMessageStatus.PENDING,
    partyId,
    message: messageData,
  };

  return await insertInto(ctx, 'DelayedMessages', delayedMessage);
};

export const updateDelayedMessageStatus = async (ctx, delayedMessageId, status) => {
  const { rows } = await rawStatement(
    ctx,
    `UPDATE db_namespace."DelayedMessages"
     SET status = :status
     WHERE id = :delayedMessageId
     RETURNING id, message, status, "partyId"`,
    [{ status, delayedMessageId }],
  );
  return rows[0];
};

export const getDelayedMessageById = async (ctx, delayedMessageId) => {
  const query = 'SELECT * FROM db_namespace."DelayedMessages" WHERE id = :delayedMessageId';
  const { rows = [] } = await rawStatement(ctx, query, [{ delayedMessageId }]);
  return rows[0];
};
