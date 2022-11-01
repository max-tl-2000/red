/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createRenewalLeaseParty } from '../../services/workflows';
import { ServiceError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isPartyEligibleForRenewal } from '../../dal/activeLeaseWorkflowRepo';
import { importActiveLeaseByPartyId } from '../../services/importActiveLeases/force-import';
import { addRenewalActivityLog } from '../../helpers/activityLogHelper';

const logger = loggerModule.child({ subType: 'api/actions/renewals' });

export const createRenewal = async request => {
  const { partyId } = request.body;
  logger.trace({ ctx: request, partyId }, 'createRenewal - input params');

  const { syncSuccessful } = await importActiveLeaseByPartyId(request, partyId);
  const eligiblePartyForRenewal = await isPartyEligibleForRenewal(request, partyId);

  if (!eligiblePartyForRenewal) {
    await addRenewalActivityLog(request, { partyId, renewalStatus: DALTypes.CreateManualRenewalStatus.NOT_SPAWNED, syncSuccessful });

    throw new ServiceError({
      token: 'PARTY_NOT_ELIGIBLE_FOR_RENEWAL',
      status: 412,
    });
  }

  const renewalLeaseParty = await createRenewalLeaseParty(request, partyId);
  logger.trace({ ctx: request, partyId, renewalLeaseParty }, 'createRenewal - done');

  await addRenewalActivityLog(request, {
    partyId,
    renewalStatus: DALTypes.CreateManualRenewalStatus.SPAWNED,
    syncSuccessful,
  });

  return renewalLeaseParty;
};
