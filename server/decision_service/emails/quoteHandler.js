/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import logger from '../../../common/helpers/logger';
import { CommunicationContext } from '../../../common/enums/communicationTypes';

export const processQuoteEmail = async (ctx, party) => {
  logger.trace({ ctx, partyId: party.id }, 'process quote events');

  const quoteEvent = party.events.find(ev => [DALTypes.PartyEventType.QUOTE_SENT].includes(ev.event));
  if (!quoteEvent) return {};

  const { quoteId, context, hostname: host, personIds = [], sendQuoteEmailEnabled, quoteEmailTemplateName } = quoteEvent.metadata;

  if (sendQuoteEmailEnabled !== 'true') {
    logger.trace({ ctx }, 'sendQuoteEmail disabled from AppSettings');
    return {};
  }

  return {
    emailInfo: {
      senderId: quoteEvent.userId,
      partyId: party.id,
      quoteId,
      host,
      personIds,
      inventoryId: party?.quotes[0].inventoryId,
      type: quoteEvent.event,
      templateName: quoteEmailTemplateName,
      context: context || CommunicationContext.PREFER_EMAIL,
    },
  };
};
