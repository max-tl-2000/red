/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import getUUID from 'uuid/v4';
import sortBy from 'lodash/sortBy';

import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';
import { DALTypes } from '../../../common/enums/DALTypes';

import * as mergeRepo from '../../dal/mergePartyRepo';
import * as partyRepo from '../../dal/partyRepo';
import * as usersRepo from '../../dal/usersRepo';

import { logEntity } from '../activityLogService';
import loggerModule from '../../../common/helpers/logger';
import { now } from '../../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

const getPreparedLog = (log, basePartyId, mergeLogDate) => ({
  ...log,
  details: {
    ...log.details,
    merged: { partyId: basePartyId, date: mergeLogDate },
  },
  context: {
    ...log.context,
    parties: [basePartyId],
  },
});

const removeMergedPartyIdFromContext = async (ctx, log, mergedPartyId) => {
  const logWithoutMergedPartyId = {
    ...log,
    context: {
      ...log.context,
      parties: (log.context.parties || []).filter(pId => pId !== mergedPartyId),
    },
  };

  return await mergeRepo.updateActivityLog(ctx, logWithoutMergedPartyId);
};

const insertNewRecord = async (ctx, log, basePartyId, mergedPartyId, mergeLogDate) => {
  await removeMergedPartyIdFromContext(ctx, log, mergedPartyId);

  const logToInsert = getPreparedLog(log, basePartyId, mergeLogDate);
  return await mergeRepo.saveActivityLog(ctx, { ...logToInsert, id: getUUID() });
};

const updateExistingRecord = async (ctx, log, basePartyId, mergeLogDate) => {
  const preparedLog = getPreparedLog(log, basePartyId, mergeLogDate);
  return await mergeRepo.updateActivityLog(ctx, preparedLog);
};

const activityTypesToBeExcluded = [ACTIVITY_TYPES.MERGE_PARTIES, ACTIVITY_TYPES.DONT_MERGE_PARTIES, ACTIVITY_TYPES.GUEST_MERGED];

// the logs that are moved from merged party to the target party will have created_at = 'merge parties' log time
// this is to be easier to see in the UI as part of which merge process each activity log was moved
const getMergeLogDate = activityLogs => {
  const mergePartyLogs = activityLogs.filter(log => log.type === ACTIVITY_TYPES.MERGE_PARTIES);
  const mergePartyLogsSorted = sortBy(mergePartyLogs, item => -now(item.created_at).utc());
  return mergePartyLogsSorted[0].created_at;
};

export const mergeActivityLogs = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergeActivityLogs - params');
  const start = new Date().getTime();

  const activityLogs = await mergeRepo.getActivityLogs(ctx, mergedPartyId);
  const activityLogsToBeMerged = activityLogs.filter(log => !activityTypesToBeExcluded.includes(log.type));

  const mergeLogDate = getMergeLogDate(activityLogs);
  // because some logs are displayed in multiple parties and we don;t want to mark them as merged in all parties,
  // when the log is associated with multiple parties, a new log record will be created and will be associated only with the base party
  const result = await mapSeries(activityLogsToBeMerged, async log =>
    log.context.parties && log.context.parties.length > 1
      ? await insertNewRecord(ctx, log, basePartyId, mergedPartyId, mergeLogDate)
      : await updateExistingRecord(ctx, log, basePartyId, mergeLogDate),
  );

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergeActivityLogs - duration');
  return result;
};

const getLogActivityType = mergeResponse =>
  mergeResponse === DALTypes.MergePartyResponse.MERGE ? ACTIVITY_TYPES.MERGE_PARTIES : ACTIVITY_TYPES.DONT_MERGE_PARTIES;

const getPartyOwnerName = async (ctx, mergeResponse, partyOwnerId) =>
  mergeResponse === DALTypes.MergePartyResponse.MERGE ? (await usersRepo.getUserById(ctx, partyOwnerId)).fullName : undefined;

const getActivityLogEntry = ({ logPartyId, firstPartyId, secondPartyId, firstPartyMembers, secondPartyMembers, partyOwner }) => {
  const getMembersData = members => members.map(m => ({ id: m.id, name: m.preferredName || m.fullName }));

  return {
    id: logPartyId,
    firstPartyId,
    secondPartyId,
    firstPartyMembers: getMembersData(firstPartyMembers),
    secondPartyMembers: getMembersData(secondPartyMembers),
    partyOwner,
  };
};

const addActivityLog = async ({ ctx, activityType, logPartyId, firstPartyId, secondPartyId, firstPartyMembers, secondPartyMembers, partyOwner }) => {
  const logEntry = getActivityLogEntry({ logPartyId, firstPartyId, secondPartyId, firstPartyMembers, secondPartyMembers, partyOwner });
  return await logEntity(ctx, { entity: logEntry, activityType, component: COMPONENT_TYPES.PARTY });
};

export const addMergeResponseLogs = async (ctx, mergeResponse, match, partyOwnerId) => {
  const activityType = getLogActivityType(mergeResponse);
  const firstPartyMembers = await partyRepo.loadPartyMembers(ctx, match.firstPartyId);
  const secondPartyMembers = await partyRepo.loadPartyMembers(ctx, match.secondPartyId);
  const partyOwner = await getPartyOwnerName(ctx, mergeResponse, partyOwnerId);

  await addActivityLog({
    ctx,
    activityType,
    logPartyId: match.firstPartyId,
    firstPartyId: match.firstPartyId,
    secondPartyId: match.secondPartyId,
    firstPartyMembers,
    secondPartyMembers,
    partyOwner,
  });

  await addActivityLog({
    ctx,
    activityType,
    logPartyId: match.secondPartyId,
    firstPartyId: match.firstPartyId,
    secondPartyId: match.secondPartyId,
    firstPartyMembers,
    secondPartyMembers,
    partyOwner,
  });
};
