/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validateToken, validateReferrer } from '../referrerAuth';
import loggerModule from '../../../common/helpers/logger';
import { updatePreferencesByPartyId } from '../../services/party';

const logger = loggerModule.child({ subType: 'api/actions/marketingProperties' });

const validateRequest = async req => {
  await validateToken(req);
  validateReferrer(req);
};

export const updateMarketingPartyPreferences = async req => {
  logger.trace({ ctx: req }, 'updateMarketingPartyPreferences action - input params');

  await validateRequest(req);

  const { partyId } = req.params;
  return await updatePreferencesByPartyId(req, partyId, req.body);
};
