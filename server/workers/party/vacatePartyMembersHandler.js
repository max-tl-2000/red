/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { setPartyMembersEndDateFromVacateDate } from '../../dal/partyRepo';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'vacatePartyMembersHandler' });

export const vacatePartyMembers = async payload => {
  const ctx = { tenantId: payload.tenantId };
  logger.trace({ ctx, vacatePartyMembersPayload: payload }, 'vacatePartyMembers - input params');

  const vacatedPartyMembers = await setPartyMembersEndDateFromVacateDate(ctx);

  logger.trace({ ctx, vacatedPartyMembers }, 'vacatePartyMembers - done');

  return { processed: true };
};
