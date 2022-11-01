/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PGPubsub from '../common/pgPubsub';
import { DALTypes } from '../../common/enums/DALTypes';
import logger from '../../common/helpers/logger';
import { sendPendingVersions } from '../dal/partyDocumentRepo';
import { getTenants } from '../dal/tenantsRepo';
import { admin } from '../common/schemaConstants';
import { knex } from '../database/factory';
import { sendMessage } from '../services/pubsub';
import { APP_EXCHANGE, PARTY_MESSAGE_TYPE } from '../helpers/message-constants';

const processPendingEvents = async () => {
  const adminCtx = { tenantId: admin.id };
  const tenants = await getTenants(knex, adminCtx);
  await Promise.all(tenants.map(async tenant => await sendPendingVersions({ tenantId: tenant.id })));
};

export const processEvents = async (autoSendPendingEvents = true) => {
  const pgClient = await new PGPubsub().connect();
  const subscription = DALTypes.NotificationChannel.PARTY_UPDATED;

  await pgClient.listen(subscription, async channelPayload => {
    logger.trace(channelPayload, 'Got PARTY_UPDATED event');
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: PARTY_MESSAGE_TYPE.DOCUMENT_HISTORY,
      message: channelPayload,
    });
  });

  if (autoSendPendingEvents) {
    await processPendingEvents();
  }

  return pgClient;
};
