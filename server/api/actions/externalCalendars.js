/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { getAuthorizationUrl, requestAccessToken } from '../../services/externalCalendars/cronofyEnterpriseService';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE, EXTERNAL_CALENDARS_TYPE } from '../../helpers/message-constants';

const logger = loggerModule.child({ subType: 'api/actions/externalCalendars' });

export const getAuthorizationUrlForEnterpriseConnect = async req => {
  logger.trace({ ctx: req }, 'getAuthorizationUrlForEnterpriseConnect');
  return getAuthorizationUrl(req);
};

export const requestAccessTokenForEnterpriseConnect = async req => {
  logger.trace({ ctx: req }, 'requestAccessTokenForEnterpriseConnect');
  const { code: singleUseCode } = req.body;
  await requestAccessToken(req, singleUseCode);
  logger.trace({ ctx: req }, 'requestAccessTokenForEnterpriseConnect - done');
};

export const syncCalendarEvents = async req => {
  logger.trace({ ctx: req }, 'syncCalendarEvents');

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.SYNC_CALENDAR_EVENTS,
    message: {
      tenantId: req.tenantId,
    },
    ctx: req,
  });
};
