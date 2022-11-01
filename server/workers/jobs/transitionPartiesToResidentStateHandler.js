/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartyIdsByPartyState } from '../../dal/partyRepo';
import { performPartyStateTransition } from '../../services/partyStatesTransitions';
import { NoRetryError } from '../../common/errors';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'jobs' });

export const transitionPartiesToResidentState = async payload => {
  const { msgCtx: ctx } = payload;
  try {
    logger.time({ ctx, payload }, 'Recurring Jobs - transitionPartiesToResidentState duration');

    const parties = await getPartyIdsByPartyState(ctx, DALTypes.PartyStateType.FUTURERESIDENT);
    const transitionedParties = [];

    await mapSeries(parties, async partyId => {
      const newPartyState = await performPartyStateTransition(ctx, partyId);
      newPartyState === DALTypes.PartyStateType.RESIDENT && transitionedParties.push(partyId);
    });

    logger.info({ ctx, transitionedParties }, 'Transitioned to residents');
  } catch (error) {
    const msg = 'Error while transitioning parties to residents';
    logger.error({ ctx, error }, msg);
    throw new NoRetryError(msg);
  }

  logger.timeEnd({ ctx, payload }, 'Recurring Jobs - transitionPartiesToResidentState duration');

  return { processed: true };
};
