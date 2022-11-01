/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { updateJsonColumn, insertInto, getOneWhere, update } from '../../../server/database/factory';
import { DALTables } from '../../common/enums/dal-tables';

export const savePersonToPersonMessage = async (ctx, communication) =>
  await insertInto(ctx.tenantId, DALTables.Tables.PERSON_TO_PERSON_COMMUNICATION, communication);

export const updatePersonToPersonMessages = async (ctx, query, delta) =>
  await update(ctx.tenantId, DALTables.Tables.PERSON_TO_PERSON_COMMUNICATION, query, {
    ...delta,
    message: updateJsonColumn(ctx, 'message', delta.message),
    status: updateJsonColumn(ctx, 'status', delta.status),
  });

export const getPersonToPersonCommunicationByMessageId = async (ctx, messageId) =>
  await getOneWhere(ctx.tenantId, DALTables.Tables.PERSON_TO_PERSON_COMMUNICATION, {
    messageId,
  });

export const getPersonToPersonCommunicationByForwardMessageId = async (ctx, forwardMessageId) =>
  await getOneWhere(ctx.tenantId, DALTables.Tables.PERSON_TO_PERSON_COMMUNICATION, {
    forwardMessageId,
  });
