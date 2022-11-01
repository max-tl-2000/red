/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import logger from '../../../common/helpers/logger';
import { postEntity, partyCreatePartyMemberEndpoint } from '../utils';
import { isCurrentParty, isFutureParty, isPastParty } from '../../../common/helpers/party-utils';

export const processCreatePartyMember = async (ctx, party, token) => {
  if (isCurrentParty(party) || isFutureParty(party) || isPastParty(party)) {
    const endpoint = partyCreatePartyMemberEndpoint(party.callBackUrl, party.id);

    const { id: partyId } = party;
    const [property] = party.property || [];
    const { id: propertyId, name: propertyName } = property || {};

    const body = {
      partyId,
      propertyId,
      propertyName,
    };

    const { error } = await postEntity(ctx, body, endpoint, token);

    if (error) {
      logger.error({ ctx, error, partyId }, 'processCreatePartyMember');
      return { error };
    }

    logger.trace({ ctx, partyId }, 'processCreatePartyMember - created');
  }

  return {};
};
