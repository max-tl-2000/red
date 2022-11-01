/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { getTenantByName } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { admin } from '../../common/schemaConstants';
import { APP_EXCHANGE, EXPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage, stopQueueConnection } from '../../services/pubsub';
import { getPartiesWithQueuedExportMessages } from '../../dal/mri-export-repo';
import sleep from '../../../common/helpers/sleep';

const logger = loggerModule.child({ subType: 'processAllQueuedMriExportMesages' });

const processAllQueuedMriExportMessages = async (ctx, { partyIdsFilter }) => {
  logger.trace({ ctx, partyIdsFilter }, 'processAllQueuedMriExportMessages - start');

  const partyIdsToProcess = await getPartiesWithQueuedExportMessages(ctx, { partyIdsFilter });

  logger.trace({ ctx, partyIdsToProcess }, 'processAllQueuedMriExportMessages - partyIdsToProcess');

  await mapSeries(
    partyIdsToProcess,
    async partyId =>
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: EXPORT_MESSAGE_TYPE.EXPORT_TO_MRI,
        message: {
          partyId,
        },
        ctx,
      }),
  );

  await sleep(2000); // adding this after local testing; without it the script exits before the message is actually added to the queue
  logger.trace({ ctx, partyIdsFilter }, 'processAllQueuedMriExportMessages - done');
};

const getTenantContext = async () => {
  const tenantName = process.argv[2];
  const ctx = { tenantId: admin.id };
  const tenant = await getTenantByName(ctx, tenantName);

  if (!tenant) {
    logger.error('Tenant not found');
    return {};
  }
  return { tenantId: tenant.id };
};

async function main() {
  const tenantCtx = await getTenantContext();
  const partyIds = process.argv[3];
  await processAllQueuedMriExportMessages(tenantCtx, { partyIdsFilter: partyIds });
}

main()
  .then(stopQueueConnection)
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while triggering queued mri export messages processing', e);
    stopQueueConnection();
    process.exit(1); // eslint-disable-line
  });
