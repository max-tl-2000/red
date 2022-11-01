/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { logEntityAdded } from '../services/activityLogService';
import { COMPONENT_TYPES, SUB_COMPONENT_TYPES } from '../../common/enums/activityLogTypes';

export const addRenewalActivityLog = async (ctx, { partyId, renewalStatus, syncSuccessful, createdByType }) => {
  const entity = {
    id: partyId,
    renewalStatus,
    syncSuccessful,
    createdByType,
  };
  await logEntityAdded(ctx, { entity, component: COMPONENT_TYPES.PARTY, subComponent: SUB_COMPONENT_TYPES.RENEWAL });
};
