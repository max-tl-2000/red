/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../../common/errors';
import { validateToken, validateReferrer } from '../referrerAuth';
import { honeypotTrapCheck } from '../helpers/honeypot';
import loggerModule from '../../../common/helpers/logger';
import { logMarketingFormMessage, sendMarketingFormMessage } from '../../services/marketingFormService';

const logger = loggerModule.child({ subType: 'marketingForm' });

const validateMandatoryFields = ({ formId, message } = {}) => {
  if (!formId) {
    throw new ServiceError({ token: 'MISSING_FORM_ID', status: 400, message: 'Missing formId' });
  }

  if (!message || !message.to || !message.body || !message.subject) {
    throw new ServiceError({ token: 'MISSING_MESSAGE_INFO', status: 400, message: 'Missing mandatory message info' });
  }
};

export const handleMarketingForm = async req => {
  const { 'x-reva-marketing-session-id': marketingSessionId } = req.headers;
  logger.trace({ ctx: req, ...req.body, marketingSessionId }, 'handleMarketingForm');

  await validateToken(req);
  validateReferrer(req);

  const { formId, message, data } = req.body;
  validateMandatoryFields({ formId, message });

  const isValidRequest = !(await honeypotTrapCheck(req, data, logger));

  await logMarketingFormMessage(req, { formId, data, marketingSessionId, isValidRequest });

  isValidRequest && (await sendMarketingFormMessage(req, { formId, message }));
};
