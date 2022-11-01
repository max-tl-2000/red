/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../common/errors';
import { respondToMarketingContactRequest } from '../../services/marketingContactService';
import { validateToken, validateReferrer } from '../referrerAuth';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'marketingContact' });

export const handleMarketingContact = async req => {
  await validateToken(req);
  validateReferrer(req);
  logger.trace({ ctx: req, ...req.body }, 'handling marketing/session request');

  const { currentUrl } = req.body;
  if (!currentUrl) throw new ServiceError({ token: 'MISSING_CURRENT_URL', status: 400 });

  // Note the spelling of referrer here is correct (different from the HTTP spec, which has incorrect spelling)
  // since we have middleware that mnutates to the correct spelling
  const res = await respondToMarketingContactRequest(req, { ...req.body, referrer: req.headers.referrer });
  if (res.error === 'PROGRAM_NOT_FOUND') throw new ServiceError({ token: 'PROGRAM_NOT_FOUND', status: 404 });

  return res;
};
