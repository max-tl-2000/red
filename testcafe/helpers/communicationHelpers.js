/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Promise from 'bluebird';
import { getCommunicationsForParty } from '../../cucumber/lib/utils/apiHelper';
import loggerInstance from '../../common/helpers/logger';
import { TEST_TENANT_ID } from '../../common/test-helpers/tenantInfo';

const logger = loggerInstance.child({ subType: 'communicationHelper' });

export const getPartyCommunications = async (partyId, { type, direction } = {}) => {
  try {
    await Promise.delay(5000);
    return await getCommunicationsForParty({ tenantId: TEST_TENANT_ID, partyId, type, direction });
  } catch (err) {
    logger.error({ err, partyId }, '>>> failed to get communications for party');
    throw err;
  }
};
