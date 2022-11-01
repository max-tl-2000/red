/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise, mapSeries } from 'bluebird';

import * as commRepo from '../../dal/communicationRepo';
import { updateUnreadCommsWithNewPartyId } from '../../dal/mergePartyRepo';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

export const mergeComms = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergeComms - params');
  const start = new Date().getTime();

  const mergedPartyComms = await commRepo.loadCommunicationsByPartyIds(ctx, [mergedPartyId]);

  const result = await Promise.reduce(
    mergedPartyComms || [],
    async (updatedComms, comm) => {
      const partiesWithoutMergedPartyId = comm.parties.filter(pId => pId !== mergedPartyId);
      const newParties = [...new Set([...partiesWithoutMergedPartyId, basePartyId])];
      const updatedComm = await commRepo.updateCommunicationEntryById(ctx, comm.id, { parties: newParties });
      return [...updatedComms, updatedComm];
    },
    [],
  );

  const mergedPartyUnreadComms = await commRepo.getUnreadCommunicationsByPartyId(ctx, mergedPartyId);
  const basePartyUnreadComms = await commRepo.getUnreadCommunicationsByPartyId(ctx, basePartyId);

  const unreadCommIdsForUpdate = [];
  const unreadCommIdsForRemoval = [];

  await mapSeries(mergedPartyUnreadComms, async unreadComm => {
    if (basePartyUnreadComms.some(c => c.communicationId === unreadComm.communicationId)) {
      unreadCommIdsForRemoval.push(unreadComm.id);
    } else {
      unreadCommIdsForUpdate.push(unreadComm.id);
    }
  });

  unreadCommIdsForUpdate.length && (await updateUnreadCommsWithNewPartyId(ctx, unreadCommIdsForUpdate, basePartyId));
  unreadCommIdsForRemoval.length && (await commRepo.removeUnreadCommunicationsByIds(ctx, unreadCommIdsForRemoval));

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergeComms - duration');
  return result;
};
