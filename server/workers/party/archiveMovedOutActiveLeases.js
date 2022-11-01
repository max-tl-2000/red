/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// This can be removed after 19.11.11 release together with the script that uses it.
import { mapSeries } from 'bluebird';

import { getTenantByName } from '../../dal/tenantsRepo';
import loggerModule from '../../../common/helpers/logger';
import { admin } from '../../common/schemaConstants';
import { getMovedOutActiveLeasesUsingExternalIds } from '../../dal/renewalV1Repo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { archiveParty } from '../../services/party';

const logger = loggerModule.child({ subType: 'archiveMovedOutActiveLeases' });

const archiveMovedOutActiveLeasesUsingExternalIds = async (ctx, { propertyIdsFilter } = {}) => {
  logger.trace({ ctx, propertyIdsFilter }, 'archiveMovedOutActiveLeasesUsingExternalIds - start');

  const movedOutActiveLeases = await getMovedOutActiveLeasesUsingExternalIds(ctx, { propertyIdsFilter });
  logger.trace(
    { ctx, numberOfMovedOut: movedOutActiveLeases.length },
    'archiveMovedOutActiveLeasesUsingExternalIds - number of moved out active leases to archive',
  );

  await mapSeries(movedOutActiveLeases, async activeLease => {
    try {
      await archiveParty(ctx, {
        partyId: activeLease.partyId,
        archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENTS_HAVE_MOVED_OUT_IDENTIFIED_BY_EXT_ID,
        options: { skipNotify: true, shouldCancelActiveTasks: false },
      });
    } catch (error) {
      logger.warn({ ctx, activeLease, error }, 'archiveMovedOutActiveLeasesUsingExternalIds - error');
    }
  });

  logger.trace({ ctx, propertyIdsFilter }, 'archiveMovedOutActiveLeasesUsingExternalIds - done');
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
  const propertyIds = process.argv[3];
  await archiveMovedOutActiveLeasesUsingExternalIds(tenantCtx, { propertyIdsFilter: propertyIds });
}

main()
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while archiving moved out active lease workflows', e);
  process.exit(1); // eslint-disable-line
  });
