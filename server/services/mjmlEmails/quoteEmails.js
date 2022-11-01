/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPersonIdsbyPartyIds, loadPartyAgent } from '../../dal/partyRepo';
import { getUserTeams, loadUserById } from '../users';
import { DALTypes } from '../../../common/enums/DALTypes';
import logger from '../../../common/helpers/logger';
import envVal from '../../../common/helpers/env-val';
import { sendCommunication } from '../communication';
import { getTenant } from '../tenantService';

export const getAuthUserForQuote = async (ctx, { partyId, from }) => {
  const partyAgent = from ? await loadUserById(ctx, from) : await loadPartyAgent(ctx, partyId);

  const agentTeams = await getUserTeams(ctx, partyAgent.id);
  // cannot use the original domain, because the request is made from self-serve widget
  const domain = `${ctx.tenantName}.${envVal('DOMAIN', 'local.env.reva.tech')}`;

  return {
    ...partyAgent,
    tenantName: ctx.tenantName,
    teams: agentTeams,
    protocol: 'https',
    domain,
  };
};

export const sendQuoteEmailComm = async (ctx, emailInfo) => {
  const { quoteId, partyId, templateName, sender, host, context, personIds: personsToSendTo = [], inventoryId = '' } = emailInfo;
  const { sender: senderForLog, ...rest } = emailInfo; // stripping sender field to reduce log noise
  logger.trace({ ctx, emailInfo: rest, sender: sender.email }, ',sending quote email communication');

  const personIds = personsToSendTo.length ? personsToSendTo : await getPersonIdsbyPartyIds(ctx, [partyId], { excludeInactive: true });

  const { settings: tenantSettings, name: tenantName } = await getTenant(ctx);
  const extendedCtx = { ...ctx, tenantName, tenantSettings, sender, host };

  await sendCommunication(extendedCtx, {
    partyId,
    personIds,
    templateArgs: {
      quoteId,
      inventoryId,
    },
    templateName,
    context,
    communicationCategory: DALTypes.CommunicationCategory.QUOTE,
  });

  logger.trace({ ctx, partyId, quoteId }, 'quote email sent successfully');
};
