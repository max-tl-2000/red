/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getApplicationSettings as getApplicationSettingsService } from '../../../../server/services/properties';
import { defined } from '../../../../server/api/helpers/validators';
import { uuid } from '../helpers/validators';
import loggerModule from '../../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'applicationSettingsActions' });

export const getApplicationSettings = async req => {
  const ctx = { ...req };
  logger.debug({ ctx }, 'getApplicationSettings');
  const { propertyId, partyType, memberType } = req.params;
  uuid(propertyId, 'INVALID_PROPERTY_ID');
  defined(partyType, 'INVALID_PARTY_TYPE');
  defined(memberType, 'INVALID_MEMBER_TYPE');

  return await getApplicationSettingsService(req, propertyId, partyType, memberType);
};
