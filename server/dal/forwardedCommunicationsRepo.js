/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'forwardedCommunicationsRepo' });

export const saveForwardedCommunications = async (ctx, forwardedCommunication) => {
  logger.trace({ ctx, forwardedCommunication }, 'saveForwardedCommunications');
  const query = `INSERT INTO db_namespace."ForwardedCommunications"
 (id, "type", "messageId", "programId", "programContactData", message, "forwardedTo", status, "receivedFrom")
 VALUES("public".gen_random_uuid(), :type, :messageId, :programId, :programContactData, :message, :forwardedTo, :status, :receivedFrom);
`;

  await rawStatement(ctx, query, [
    {
      type: forwardedCommunication.type,
      messageId: forwardedCommunication.messageId,
      programId: forwardedCommunication.programId,
      programContactData: forwardedCommunication.programContactData,
      message: JSON.stringify(forwardedCommunication.message),
      forwardedTo: forwardedCommunication.forwardedTo,
      status: {
        status: [{ address: forwardedCommunication.forwardedTo, status: DALTypes.CommunicationStatus.PENDING }],
      },
      receivedFrom: forwardedCommunication.receivedFrom,
    },
  ]);
};

export const getForwardedCommunications = async ctx => {
  const query = `
    SELECT id, "type", "messageId", "programId", "programContactData", message, "forwardedTo", "receivedFrom"
     FROM db_namespace."ForwardedCommunications"; `;
  const { rows } = await rawStatement(ctx, query, []);
  return rows;
};

export const getForwardedCommunicationByMessageId = async (ctx, messageId) => {
  const query = `
    SELECT id, status, message, type, "receivedFrom"
    FROM db_namespace."ForwardedCommunications"
    WHERE "messageId" = :messageId
  `;

  const { rows } = await rawStatement(ctx, query, [{ messageId }]);
  return rows[0];
};

export const updateForwardedMessages = async (ctx, id, status) => {
  logger.trace({ ctx, id, status }, 'updateForwardedMessages');
  const query = `UPDATE db_namespace."ForwardedCommunications"
  SET status = :status
  WHERE id = :id
  RETURNING *;
`;

  const { rows } = await rawStatement(ctx, query, [{ id, status: JSON.stringify(status) }]);
  return rows[0];
};
