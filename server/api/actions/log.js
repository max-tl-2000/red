/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { defined as validateDefined } from '../helpers/validators';
import { ServiceError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';
import { hasOwnProp } from '../../../common/helpers/objUtils';
import { removeToken } from '../../../common/helpers/strings';

const logger = loggerModule.child({ subType: 'clientLogs' });

const sanitizeLogData = message => {
  if (!hasOwnProp(message, 'currentUrl')) return message;

  return {
    ...message,
    currentUrl: removeToken(message.currentUrl),
  };
};

export function log(req) {
  const messages = req.body;
  validateDefined(messages, 'MISSING_MESSAGES');
  if (!Array.isArray(messages) || !messages.length) {
    throw new ServiceError({
      token: 'MISSING_MESSAGES',
      status: 400,
    });
  }

  messages.forEach(msg => {
    const { loggingMessage, severity, ...structuredData } = sanitizeLogData(msg);
    validateDefined(loggingMessage, 'MISSING_MESSAGE');

    const loggerFunc = (logger[severity] || logger.info).bind(logger);
    loggerFunc({ ctx: req, ...structuredData }, loggingMessage);
  });
}
