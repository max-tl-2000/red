/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getFirstComm } from '../../services/helpers/communicationHelpers';
import * as corticon from './corticon';
import { computePartyScore } from './default';
import logger from '../../../common/helpers/logger';
import { partyScoreIntegrationEndpoint } from '../utils';

export const recomputePartyScore = async ({ ctx, party, token, useCorticon }) => {
  const firstComm = getFirstComm(party.comms);
  const initialContact = firstComm && firstComm.created_at;

  const appointments = (party.tasks || []).filter(t => t.category === DALTypes.TaskCategories.APPOINTMENT && t.state !== DALTypes.TaskStates.CANCELED);

  const score = useCorticon
    ? await corticon.computePartyScore(party.id, party.startDate, appointments, initialContact)
    : computePartyScore(party.startDate, appointments, initialContact);

  if (score !== party.score) {
    logger.trace({ ctx, partyId: party.id, oldScore: party.score, newScore: score }, 'recomputePartyScore - score changed');
    const res = await request
      .post(partyScoreIntegrationEndpoint(ctx.body?.callBackUrl, party.id))
      .send({
        partyId: party.id,
        score,
      })
      .set('accept', 'json')
      .set('Authorization', `Bearer ${token}`);

    logger.trace({ ctx, partyId: party.id, oldScore: party.score, newScore: score, reqStatus: res.status }, 'recomputePartyScore - score changed');
  }

  return { score };
};
