/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniqBy from 'lodash/uniqBy';
import sortBy from 'lodash/sortBy';
import some from 'lodash/some';
import get from 'lodash/get';
import flatten from 'lodash/flatten';

import getUUID from 'uuid/v4';
import { mapSeries } from 'bluebird';

import { DALTypes } from '../../../common/enums/DALTypes';
import { getKeyByValue } from '../../../common/enums/enumHelper';
import loggerModule from '../../../common/helpers/logger';
import { getActiveAppointments } from '../../helpers/party';
import { sortPartiesForMerge, sortPartiesByWorkFlowName } from '../helpers/party';
import { runInTransaction } from '../../database/factory';

import * as partyRepo from '../../dal/partyRepo';
import * as mergeRepo from '../../dal/mergePartyRepo';
import * as leaseRepo from '../../dal/leaseRepo';
import * as commRepo from '../../dal/communicationRepo';
import * as taskRepo from '../../dal/tasksRepo';
import * as quoteRepo from '../../dal/quoteRepo';
import * as usersRepo from '../../dal/usersRepo';
import * as apptsRepo from '../../dal/appointmentRepo';

import { getPropertyById, getPropertyByPartyId } from '../../dal/propertyRepo';

import { savePartyMergedEvent, savePartyOwnerChanged, savePartyArchivedEvent } from '../partyEvent';

import * as taskService from '../tasks';
import * as partyService from '../party';
import * as leaseService from '../leases/leaseService';
import * as calendar from '../calendar';
import { getExportMergedPartyData } from '../export';
import { performPartyStateTransition } from '../partyStatesTransitions';
import { getApplicationPaymentsForParty } from '../applications';

import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';

import { mergePartySpecificFields } from './mergePartySpecificFields';
import { mergePartyMembers } from './mergeMembers';
import { mergeTasks } from './mergeTasks';
import { mergeComms } from './mergeComms';
import { addMergeResponseLogs, mergeActivityLogs } from './mergeActivityLogs';
import { mergeQuotes, mergeInventoriesOnHold } from './mergeQuotes';
import { mergeQuotePromotions } from './mergeQuotePromotions';
import { mergePersonApplications } from './mergePersonApplications';
import { mergePartyApplication } from './mergePartyApplication';
import { mergePartyApplicationDocuments } from './mergePartyApplicationDocuments';
import { mergePersonApplicationDocuments } from './mergePersonApplicationDocuments';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { updateHoldForIntlAddr, updateLinkedGuarantor, resetBadHoldScreening } from '../../../rentapp/server/screening/screening-helper';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE, TASKS_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../pubsub';
import { ServiceError } from '../../common/errors';
import { archiveAllExternalInfoByParty } from '../externalPartyMemberInfo';
import { releaseManuallyHeldInventoriesByParty } from '../inventories';
import { getTenantSettings } from '../tenantService';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

export const createMergePartySession = async (ctx, mergeContext) => {
  logger.trace({ ctx, mergeContextPartySession: mergeContext }, 'createMergePartySession - params');

  const session = {
    id: getUUID(),
    context: mergeContext,
  };

  const savedSession = await mergeRepo.saveMergePartySession(ctx, session);
  logger.trace({ ctx, savedSession }, 'createMergePartySession - saved session');

  return savedSession;
};

const validPartyStatesForMerge = [
  DALTypes.PartyStateType.CONTACT,
  DALTypes.PartyStateType.LEAD,
  DALTypes.PartyStateType.PROSPECT,
  DALTypes.PartyStateType.APPLICANT,
  DALTypes.PartyStateType.LEASE,
  DALTypes.PartyStateType.FUTURERESIDENT,
  DALTypes.PartyStateType.RESIDENT,
];

const getBasePartyId = session => {
  const resolvedMatches = session.matches.filter(match => match.response === DALTypes.MergePartyResponse.MERGE);
  const resolvedMatchesSorted = sortBy(resolvedMatches, item => -toMoment(item.created_at).utc());

  return resolvedMatchesSorted.length ? resolvedMatchesSorted[0].resultPartyId : session.context.partyId;
};

const isNewLease = party => party.workflowName === DALTypes.WorkflowName.NEW_LEASE;

const getBaseParty = async (ctx, partyId) => {
  const baseParty = await partyRepo.loadPartyById(ctx, partyId);

  return isNewLease(baseParty)
    ? {
        ...baseParty,
        hasPublishedQuotes: (await quoteRepo.getPublishedQuotesByPartyId(ctx, partyId)).length,
        hasOriginalApplications: (await mergeRepo.getOriginalApplicationsByPartyId(ctx, partyId)).length,
      }
    : baseParty;
};

const checkIfPartiesAreEligibleForMerge = (ctx, baseParty, matchParty) => {
  if (!isNewLease(baseParty) && isNewLease(matchParty)) return !(matchParty.hasPublishedQuotes || matchParty.hasOriginalApplications);
  if (isNewLease(baseParty) && !isNewLease(matchParty)) return !(baseParty.hasPublishedQuotes || baseParty.hasOriginalApplications);

  return true;
};

const getPossiblePartyMatchesByPartyId = async (ctx, session) => {
  const basePartyId = getBasePartyId(session);
  const baseParty = await getBaseParty(ctx, basePartyId);
  const { assignedPropertyId, workflowName, leaseType, partyGroupId } = baseParty;
  const { partyCohortId } = await getPropertyById(ctx, assignedPropertyId, false);

  if (!assignedPropertyId || workflowName === DALTypes.WorkflowName.RENEWAL) return [];

  const partyMembers = await partyRepo.getPartyMembersByPartyIds(ctx, [basePartyId]);
  const personIds = [...new Set(partyMembers.map(m => m.personId))];
  const partiesForPersonsFilters = {
    personIds,
    partyCohortId,
    leaseType,
    validPartyStatesForMerge,
    partyGroupId,
    excludedWorkflowState: DALTypes.WorkflowState.ARCHIVED,
    workflowName,
  };

  const partiesForPersons = await mergeRepo.getPartiesForPersons(ctx, partiesForPersonsFilters);

  /*
    This array needs to be sorted so that in the case in which there are new workflows as
    candidates for merging, the new lease workflows will be merged first and the renewals/active
    workflows after.
  */
  const sortedPartiesForPersons = sortPartiesByWorkFlowName(partiesForPersons);

  const filteredPartiesForPersons = sortedPartiesForPersons.filter(partyForPerson => {
    const areBothWorkflowsActive =
      partyForPerson.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE && baseParty.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE;

    return !areBothWorkflowsActive && checkIfPartiesAreEligibleForMerge(ctx, baseParty, partyForPerson);
  });

  const partyGroupIds = [...new Set(filteredPartiesForPersons.map(p => p.partyGroupId))];

  return partyGroupIds.map(pGroupId => {
    const partiesInPartyGroup = filteredPartiesForPersons.filter(p => p.partyGroupId === pGroupId);
    const renewalParty = partiesInPartyGroup.find(p => p.workflowName === DALTypes.WorkflowName.RENEWAL);
    const activeLeaseParty = partiesInPartyGroup.find(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE);
    const newLeaseParty = partiesInPartyGroup.find(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE);
    const partyToBeMerged = renewalParty || activeLeaseParty || newLeaseParty;

    return { p1: basePartyId, p2: partyToBeMerged.id };
  });
};

const getAvailableMatches = async (ctx, sessionId) => {
  const session = await mergeRepo.getMergePartySession(ctx, sessionId);

  const possibleMatches = await getPossiblePartyMatchesByPartyId(ctx, session);
  logger.trace({ ctx, possibleMatches }, 'getAvailableMatches - possibleMatches');

  if (possibleMatches.length === 0) return [];

  const resolvedMatches = session.matches.map(match => ({
    p1: match.firstPartyId,
    p2: match.secondPartyId,
  }));
  logger.trace({ ctx, resolvedMatches }, 'getAvailableMatches - resolvedMatches');

  const availableMatches = possibleMatches.filter(
    possibleMatch =>
      !some(resolvedMatches, { p1: possibleMatch.p1, p2: possibleMatch.p2 }) && !some(resolvedMatches, { p1: possibleMatch.p2, p2: possibleMatch.p1 }),
  );
  logger.trace({ ctx, availableMatches }, 'getAvailableMatches - availableMatches');

  return availableMatches;
};

const isMergeConflict = async (ctx, basePartyData, mergedPartyData) => {
  const { leases: basePartyLeases, members: basePartyMembers } = basePartyData;
  const { leases: mergedPartyLeases, members: mergedPartyMembers } = mergedPartyData;

  const basePartyHasActiveLease = basePartyLeases.some(l => l.status !== DALTypes.LeaseStatus.VOIDED);
  const mergedPartyHasActiveLease = mergedPartyLeases.some(l => l.status !== DALTypes.LeaseStatus.VOIDED);

  const areLeasesOnBothParties = basePartyHasActiveLease && mergedPartyHasActiveLease;
  const areMergedPartyMembersInBaseParty = mergedPartyMembers.every(pm => basePartyMembers.some(pm2 => pm2.personId === pm.personId));

  const isConflict = areLeasesOnBothParties || (!areMergedPartyMembersInBaseParty && basePartyHasActiveLease);

  logger.trace(
    {
      ctx,
      areLeasesOnBothParties,
      areMergedPartyMembersInBaseParty,
      basePartyHasActiveLease,
      mergedPartyHasActiveLease,
    },
    'isMergeConflict - result',
  );

  return isConflict;
};

const constructPartyMatch = (ctx, sessionId, availableMatch) => {
  logger.trace({ ctx, sessionId, availableMatch }, 'constructPartyMatch - params');

  const match = {
    id: getUUID(),
    sessionId,
    firstPartyId: availableMatch.p1,
    secondPartyId: availableMatch.p2,
    response: DALTypes.MergePartyResponse.NONE,
  };

  logger.trace({ ctx, sessionId }, 'constructPartyMatch - match');
  return match;
};

const getPartyData = async (ctx, partyId) => ({
  party: await partyRepo.loadParty(ctx, partyId),
  tasks: await taskRepo.getTasksByPartyIds(ctx, [partyId]),
  quotes: await quoteRepo.getQuotesByPartyId(ctx, partyId),
  members: await partyRepo.loadPartyMembers(ctx, partyId),
  leases: await leaseRepo.getPartyLeases(ctx, partyId),
  lastContactedDate: await commRepo.getPartyLastContactedDate(ctx, [partyId]),
  applicationPayments: await getApplicationPaymentsForParty(ctx, partyId),
  property: await getPropertyByPartyId(ctx, partyId),
});

const getBasePartyForMergeResult = (firstParty, secondParty) => (sortPartiesForMerge([firstParty, secondParty])[0] || {}).party;

export const generateNextPartyMatch = async (ctx, sessionId) => {
  logger.trace({ ctx, sessionId }, 'generateNextPartyMatch - params');

  const availableMatches = await getAvailableMatches(ctx, sessionId);
  if (availableMatches.length === 0) return {}; // there are no more possible matches in the current merge session

  const nextAvailableMatch = availableMatches[0];
  logger.trace({ ctx, nextAvailableMatch }, 'generateNextPartyMatch - nextAvailableMatch');

  const savedMatch = await mergeRepo.saveMergePartyMatch(ctx, constructPartyMatch(ctx, sessionId, nextAvailableMatch));
  logger.trace({ ctx, savedMatch }, 'generateNextPartyMatch - savedMatch');

  const firstPartyData = await getPartyData(ctx, nextAvailableMatch.p1);
  const secondPartyData = await getPartyData(ctx, nextAvailableMatch.p2);
  const baseParty = getBasePartyForMergeResult(firstPartyData, secondPartyData);

  const resultPartyTasks = [...firstPartyData.tasks, ...secondPartyData.tasks];
  const resultPartyQuotes = [...firstPartyData.quotes, ...secondPartyData.quotes];
  const resultPartyMembers = [...firstPartyData.members, ...secondPartyData.members];
  const isConflict =
    baseParty.id === firstPartyData.party.id
      ? await isMergeConflict(ctx, firstPartyData, secondPartyData)
      : await isMergeConflict(ctx, secondPartyData, firstPartyData);
  const getResultLastContactedDate =
    firstPartyData.lastContactedDate >= secondPartyData.lastContactedDate ? firstPartyData.lastContactedDate : secondPartyData.lastContactedDate;

  const firstPartyOwner = await usersRepo.getUserFullNameById(ctx, firstPartyData.party.userId);
  const secondPartyOwner = await usersRepo.getUserFullNameById(ctx, secondPartyData.party.userId);

  const nextMatch = {
    matchId: savedMatch.id,
    sessionId,
    isMergeConflict: isConflict,
    firstParty: {
      ...firstPartyData.party,
      lastContactedDate: firstPartyData.lastContactedDate,
      partyOwner: firstPartyOwner,
      property: firstPartyData.property,
    },
    secondParty: {
      ...secondPartyData.party,
      lastContactedDate: secondPartyData.lastContactedDate,
      partyOwner: secondPartyOwner,
      property: secondPartyData.property,
    },
    result: {
      ...baseParty,
      partyMembers: uniqBy(resultPartyMembers, 'personId'),
      lastContactedDate: getResultLastContactedDate,
      appointments: getActiveAppointments(resultPartyTasks).length,
      quotes: resultPartyQuotes.length,
    },
  };

  logger.trace(
    { ctx, nextMatch: { firstPartyId: nextMatch.firstParty.id, secondPartyId: nextMatch.secondParty.id, resultId: nextMatch.result.id } },
    'generateNextPartyMatch - nextMatch',
  );
  return nextMatch;
};

const getAllMessagesToSend = mergeResult =>
  Object.keys(mergeResult).reduce(
    (result, key) => {
      const { messagesToSend, ...rest } = mergeResult[key];
      result.messages = [...result.messages, ...(messagesToSend || [])];
      result.merge[key] = rest;
      return result;
    },
    { merge: {}, messages: [] },
  );

const sendMessages = async (ctx, matchId, messages = []) => {
  logger.trace({ ctx }, 'mergeParties - sendMessages');
  const start = new Date().getTime();

  await mapSeries(messages, async message => {
    const { messagePromise } = message;
    try {
      logger.trace({ ctx, messagePromise }, 'mergeParties - sending message');
      await message.messagePromise(...message.args);
      logger.trace({ ctx, messagePromise }, 'mergeParties - message sent');
    } catch (error) {
      logger.error({ ctx, messagePromise, error }, 'mergeParties - sending message failed');
    }
  });

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergeParties - messages were sent successfully');
};

const archiveMergedParty = async (ctx, mergedPartyId, mergeEverything) => {
  logger.trace({ ctx, mergedPartyId }, 'mergeParties - archive merged party');
  await partyRepo.archiveParty(ctx, mergedPartyId, getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY));

  !mergeEverything && (await releaseManuallyHeldInventoriesByParty(ctx, mergedPartyId));

  await archiveAllExternalInfoByParty(ctx, mergedPartyId);

  await savePartyArchivedEvent(ctx, {
    partyId: mergedPartyId,
    userId: (ctx.authUser || {}).id,
    metadata: { archiveReason: getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY) },
  });
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.PARTY_ARCHIVED,
    message: { tenantId: ctx.tenantId, partyId: mergedPartyId },
    ctx,
  });

  const tenantSettings = await getTenantSettings(ctx);
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND,
    message: { tenantId: ctx.tenantId, partyId: mergedPartyId, authUser: ctx.authUser, tenantSettings },
    categoriesToExclude: [],
    ctx,
  });
};

const updateBasePartyAssignedPropertyIfNeeded = async (ctx, basePartyId, basePartyAssignedPropertyId, chosenProperty) => {
  logger.trace({ ctx, basePartyId, basePartyAssignedPropertyId, chosenProperty }, 'mergeParties - updateBasePartyAssignedPropertyIfNeeded');
  if (!chosenProperty || (chosenProperty && basePartyAssignedPropertyId === chosenProperty.id)) return;

  const assignedPropertyId = chosenProperty && chosenProperty.id;
  await mergeRepo.updateParty(ctx, { id: basePartyId, assignedPropertyId });
};

const reassignBaseParty = async ({ ctx, basePartyId, basePartyUserId, partyOwnerId, ownerTeamId }) => {
  if (basePartyUserId === partyOwnerId) return;

  // load the party again to make sure we have the latest data (eg. party.collaborators might have been changed in another function)
  const baseParty = await partyRepo.loadPartyById(ctx, basePartyId);

  logger.trace({ ctx, from: baseParty.userId, to: partyOwnerId }, 'mergeParties - reassignParty');
  const reassignDelta = await partyService.getAssignPartyToUserDelta(ctx, baseParty, partyOwnerId, ownerTeamId, false);
  await taskService.reassignActivePartyTasks(ctx, baseParty.id, baseParty.userId, partyOwnerId, ownerTeamId);
  await leaseService.reassignCountersignerSignatureStatuses(ctx, baseParty.id, partyOwnerId);
  const updatedParty = await mergeRepo.updateParty(ctx, { id: baseParty.id, ...reassignDelta });

  await savePartyOwnerChanged(ctx, {
    partyId: basePartyId,
    userId: (ctx.authUser || {}).id,
    metadata: {
      previousOwner: baseParty.userId,
      previousTeam: baseParty.ownerTeam,
      newOwner: updatedParty.userId,
      newOwnerTeam: updatedParty.ownerTeam,
    },
  });
};

const saveExportPartyData = async (ctx, matchId, mergedParty) => {
  logger.trace({ ctx, matchId }, 'saveExportPartyData - params');
  const mergedPartyExportData = await getExportMergedPartyData(ctx, mergedParty);
  await mergeRepo.updateMergePartyMatch(ctx, matchId, { exportData: mergedPartyExportData });
  logger.trace({ ctx, matchId }, 'party data for export saved successfully');
};

const mergeAllEntities = (firstPartyWorkFlowName, secondPartyWorkFlowName) =>
  firstPartyWorkFlowName === DALTypes.WorkflowName.NEW_LEASE && secondPartyWorkFlowName === firstPartyWorkFlowName;

const mergeEntities = async (ctx, { basePartyId, mergedPartyId, partyOwnerId, mergedPartyUserId, mergeEverything }) => {
  const mergedComms = await mergeComms(ctx, basePartyId, mergedPartyId);
  if (!mergeEverything) {
    return {
      comms: mergedComms,
    };
  }
  const membersResult = await mergePartyMembers(ctx, basePartyId, mergedPartyId);
  const mergedActivityLogs = await mergeActivityLogs(ctx, basePartyId, mergedPartyId);
  const mergedInventoriesOnHold = await mergeInventoriesOnHold(ctx, basePartyId, mergedPartyId);
  const mergedPromotions = await mergeQuotePromotions(ctx, basePartyId, mergedPartyId);
  const mergedQuotes = await mergeQuotes(ctx, basePartyId, mergedPartyId);
  const partyApplication = await mergePartyApplication(ctx, basePartyId, mergedPartyId);
  const partyApplicationDocuments = await mergePartyApplicationDocuments(ctx, basePartyId, mergedPartyId);
  const updatedBasePartyFields = await mergePartySpecificFields(ctx, basePartyId, mergedPartyId);
  const { invoices, personApplications } = await mergePersonApplications(ctx, basePartyId, mergedPartyId);
  const personApplicationDocuments = await mergePersonApplicationDocuments(ctx, basePartyId, mergedPartyId);

  const mergedTasks = await mergeTasks({
    ctx,
    basePartyId,
    mergedPartyId,
    mergedPartyUserId,
    mergedMembers: membersResult.members,
    partyOwnerId,
  });

  return {
    partyFields: updatedBasePartyFields,
    members: membersResult,
    tasks: mergedTasks,
    comms: mergedComms,
    activityLogs: mergedActivityLogs,
    quotes: mergedQuotes,
    promotions: mergedPromotions,
    personApplications,
    invoices,
    partyApplication,
    partyApplicationDocuments,
    mergedInventoriesOnHold,
    personApplicationDocuments,
  };
};

const mergeParties = async (ctx, match, partyOwnerId, ownerTeamId, chosenProperty) => {
  logger.trace({ ctx, match, partyOwnerId, chosenProperty }, 'mergeParties - params');

  const firstPartyData = await getPartyData(ctx, match.firstPartyId);
  const secondPartyData = await getPartyData(ctx, match.secondPartyId);
  const { party: firstParty } = firstPartyData;
  const { party: secondParty } = secondPartyData;
  const mergeEverything = mergeAllEntities(firstParty.workflowName, secondParty.workflowName);
  const { id: basePartyId, userId: basePartyUserId, assignedPropertyId: basePartyAssignedPropertyId } = getBasePartyForMergeResult(
    firstPartyData,
    secondPartyData,
  );
  const mergedParty = firstParty.id === basePartyId ? secondParty : firstParty;
  const { id: mergedPartyId, userId: mergedPartyUserId } = mergedParty;
  logger.trace(
    {
      ctx,
      basePartyId,
      mergedPartyId,
    },
    'mergeParties - basePartyId and mergedPartyId',
  );

  await saveExportPartyData(ctx, match.id, mergedParty);
  const mergeChanges = await mergeEntities(ctx, { basePartyId, mergedPartyId, partyOwnerId, mergedPartyUserId, mergeEverything });
  const { merge, messages } = getAllMessagesToSend(mergeChanges);
  await archiveMergedParty(ctx, mergedPartyId, mergeEverything);
  await reassignBaseParty({ ctx, basePartyId, basePartyUserId, partyOwnerId, ownerTeamId });
  chosenProperty && (await updateBasePartyAssignedPropertyIfNeeded(ctx, basePartyId, basePartyAssignedPropertyId, chosenProperty));
  await performPartyStateTransition(ctx, basePartyId);

  return {
    basePartyId,
    mergedPartyId,
    changes: merge,
    messages,
  };
};

const getDataBeforeMerge = async (ctx, match) => ({
  firstParty: await mergeRepo.getAllPartyData(ctx, match.firstPartyId),
  secondParty: await mergeRepo.getAllPartyData(ctx, match.secondPartyId),
});

const sendPartyUpdatedNotifications = async (ctx, resolveMatchResult) => {
  const { basePartyId, mergedPartyId } = resolveMatchResult;

  const baseParty = await partyRepo.loadPartyById(ctx, basePartyId);
  if (baseParty) {
    notify({
      ctx,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId: basePartyId },
      routing: { teams: baseParty.teams },
    });
  }

  const mergedParty = await partyRepo.loadPartyById(ctx, mergedPartyId);
  if (mergedParty) {
    notify({
      ctx,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId: mergedPartyId },
      routing: { teams: mergedParty.teams },
    });
  }
};

const getOverlappingAppointmentsOfPartyOwners = async (ctx, firstParty, secondParty) => {
  const firstPartyMergeAppts = await apptsRepo.loadFutureAppointmentsForPartyAndUser(ctx, firstParty.id, firstParty.userId);
  const secondPartyMergeAppts = await apptsRepo.loadFutureAppointmentsForPartyAndUser(ctx, secondParty.id, secondParty.userId);

  return flatten(
    firstPartyMergeAppts.map(a1 => {
      const overlapping = secondPartyMergeAppts.filter(a2 => calendar.appointmentsOverlap(a1, a2));
      return overlapping.length ? [a1, ...overlapping] : [];
    }),
  );
};

export const checkConflictingAppointmentsAtMerge = async (ctx, { firstPartyId, secondPartyId, newOwnerId, newOwnerTeamId }) => {
  const firstParty = await partyRepo.loadPartyById(ctx, firstPartyId);

  const firstPartyOverlappingAppts =
    firstParty.userId === newOwnerId
      ? []
      : await partyService.getOverlappingAppointments(ctx, { party: firstParty, userId: newOwnerId, teamId: newOwnerTeamId });

  const secondParty = await partyRepo.loadPartyById(ctx, secondPartyId);
  const secondPartyOverlappingAppts =
    secondParty.userId === newOwnerId
      ? []
      : await partyService.getOverlappingAppointments(ctx, { party: secondParty, userId: newOwnerId, teamId: newOwnerTeamId });

  const overlappingApptsBetweenParties =
    firstParty.userId !== secondParty.userId && firstParty.userId !== newOwnerId && secondParty.userId !== newOwnerId
      ? await getOverlappingAppointmentsOfPartyOwners(ctx, firstParty, secondParty)
      : [];

  const overlappingAppts = uniqBy([...firstPartyOverlappingAppts, ...secondPartyOverlappingAppts, ...overlappingApptsBetweenParties], 'id');
  if (overlappingAppts.length) {
    throw new ServiceError({
      token: 'APPOINTMENTS_CONFLICT',
      status: 412,
      data: {
        appointments: overlappingAppts,
      },
    });
  }
};

export const resolvePartyMatch = async (ctx, { matchId, response, partyOwnerId, ownerTeamId, shouldCheckConflictingAppointments, chosenProperty }) => {
  logger.trace({ ctx, matchId, response, partyOwnerId, ownerTeamId, chosenProperty }, 'resolvePartyMatch - params');
  const start = new Date().getTime();

  let delta = {
    resolvedBy: ctx.authUser.id,
    response,
  };
  const isMergeResponse = response === DALTypes.MergePartyResponse.MERGE;

  const resolveMatchResult = await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    let result;

    const match = await mergeRepo.getMergePartyMatch(innerCtx, matchId);
    await addMergeResponseLogs(innerCtx, response, match, partyOwnerId);

    if (isMergeResponse) {
      if (shouldCheckConflictingAppointments) {
        await checkConflictingAppointmentsAtMerge(ctx, {
          firstPartyId: match.firstPartyId,
          secondPartyId: match.secondPartyId,
          newOwnerId: partyOwnerId,
          newOwnerTeamId: ownerTeamId,
        });
      }

      const dataBeforeMerge = await getDataBeforeMerge(innerCtx, match);
      result = await mergeParties(innerCtx, match, partyOwnerId, ownerTeamId, chosenProperty);

      delta = {
        ...delta,
        dataBeforeMerge,
        resultPartyId: result.basePartyId,
        mergeChanges: result.changes,
      };

      await mergeRepo.updateParty(innerCtx, {
        id: result.mergedPartyId,
        mergedWith: result.basePartyId,
        endDate: now().toJSON(),
      });

      await savePartyMergedEvent(innerCtx, {
        partyId: result.mergedPartyId,
        userId: ctx.authUser.id,
        metadata: {
          mergedWith: result.basePartyId,
          matchId: match.id,
        },
      });
    }

    const updatedMergePartyMatch = await mergeRepo.updateMergePartyMatch(innerCtx, matchId, delta);
    const mergeResult = {
      ...result,
      updatedMergePartyMatch,
    };

    if (isMergeResponse) {
      await sendMessages(innerCtx, matchId, mergeResult.messages);
      await sendPartyUpdatedNotifications(innerCtx, mergeResult);
    }

    return mergeResult;
  }, ctx);

  const resultPartyId = get(resolveMatchResult, 'updatedMergePartyMatch.resultPartyId');

  if (resultPartyId && isMergeResponse) {
    await runInTransaction(async trx => {
      const innerCtx = { ...ctx, trx };
      await resetBadHoldScreening(innerCtx, resultPartyId);
      await updateHoldForIntlAddr(innerCtx, resultPartyId);
      await updateLinkedGuarantor(innerCtx, resultPartyId);
    });
  }
  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'resolvePartyMatch - duration');

  return { resultPartyId };
};
