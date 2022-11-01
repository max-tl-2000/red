/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'decision_service/emailsHandler' });

export const processCustomMessage = async (ctx, party, token) => {
  logger.trace({ ctx, party, token }, 'customMessagesHandler/processCustomMessage');

  const customMessageEvent = party.events.find(ev => [DALTypes.PartyEventType.CUSTOM_MESSAGE].includes(ev.event));

  if (!customMessageEvent) return {};

  return {};
};
