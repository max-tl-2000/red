/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import _, { isArray, isDate, isEmpty } from 'lodash'; // eslint-disable-line red/no-lodash
import { mapSeries } from 'bluebird';
import flatten from 'lodash/flatten';
import {
  saveActivityLog,
  getDisplayNoData,
  getActivityLogsByParty as getActivityLogsByPartyFromDb,
  getActivityLogById as getActivityLogByIdFromDb,
} from '../dal/activityLogRepo';
import { loadPartyById } from '../dal/partyRepo';
import { getRevaAdmin } from '../dal/usersRepo';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import { getPersonsDisplayNamesByIds } from './person';
import loggerModule from '../../common/helpers/logger';
import { saveLog as saveAnalyticsLog } from './analyticsLogService';
import { getShortFormatRentableItem } from '../helpers/inventory';
import { toMoment, getDurationBetweenMoments } from '../../common/helpers/moment-utils';
import { assignPartyOrUpdateCollaborators } from './partyCollaborators';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { isRevaAdmin } from '../../common/helpers/auth';

const logger = loggerModule.child({ subType: 'activity log service' });

const saveLog = async (req, { detailsData, type, component, subComponent, options = { skipNotify: false } }) => {
  const {
    propertyDisplayName,
    ownerTeamDisplayName,
    createdByType = DALTypes.CreatedByType.USER,
    isAdminUser = false,
    id,
    commAgent,
    ...details
  } = detailsData;
  const partyId = component === COMPONENT_TYPES.PARTY ? id : detailsData.partyId;
  const displayNoData = await getDisplayNoData(req, partyId, component, id);

  const { authUser, userId, sender } = req;

  const users = (authUser?.id && [authUser.id]) || (userId && [userId]) || (sender?.id && [sender.id]) || (commAgent && [commAgent]) || [];

  const activityLog = {
    type,
    component,
    subComponent,
    details: {
      seqDisplayNo: displayNoData.seqDisplayNo,
      merged: displayNoData.merged,
      propertyDisplayName,
      ownerTeamDisplayName,
      id,
      createdByType,
      ...details,
    },
    context: {
      users,
      parties: [partyId],
    },
  };

  try {
    const log = await saveActivityLog(req, activityLog);
    const { shouldUpdateCollaborators = true } = detailsData;

    if (!isAdminUser && users.length && shouldUpdateCollaborators) {
      // TODO: this does not seems the best place to update the Party collaborators
      // Why saving a log entry is causing the party to be updated?
      await assignPartyOrUpdateCollaborators(req, partyId, users);
    }

    if (!options.skipNotify) {
      const party = await loadPartyById(req, partyId);

      notify({
        ctx: req,
        event: eventTypes.PARTY_UPDATED,
        data: { partyId: party.id },
        routing: { teams: [party.ownerTeam, ...party.teams] },
      });
    }

    await saveAnalyticsLog({
      ctx: req,
      type,
      component,
      subComponent,
      entityId: id,
      activityDetails: activityLog.details,
      activityContext: log.context,
    });

    return log;
  } catch (error) {
    logger.error({ ctx: req, error }, 'activityLogService saveLog error');
    return undefined;
  }
};

export const logEntityAdded = async (req, { entity, component, subComponent, options }) =>
  await saveLog(req, { detailsData: entity, type: ACTIVITY_TYPES.NEW, component, subComponent, options });

export const logEntityRemoved = async (req, entity, component) => await saveLog(req, { detailsData: entity, type: ACTIVITY_TYPES.REMOVE, component });

export const logEntity = async (req, { entity, activityType, component, subComponent, options }) =>
  await saveLog(req, { detailsData: entity, type: activityType, component, subComponent, options });

// properties that are arrays should be sorted before they are are passed to this function;
// otherwise they will be considered as being different
const getUpdateDelta = (prevState, nextState) => {
  function valueHasChanged(key) {
    const prevValue = prevState[key];
    const newValue = nextState[key];

    if (isArray(prevValue)) {
      return JSON.stringify(prevValue) !== JSON.stringify(newValue);
    }
    if (isDate(prevValue)) return !toMoment(prevValue).isSame(newValue);
    return prevValue !== newValue;
  }

  return {
    ..._.pick(nextState, _.keys(nextState).filter(valueHasChanged)),
    ..._.pick(prevState, _.difference(_.keys(prevState), _.keys(nextState))),
  };
};

export const logEntityUpdated = async ({
  req,
  entityPrevState,
  entityNextState,
  component,
  taskCategory,
  createdByType = DALTypes.CreatedByType.USER,
  type = ACTIVITY_TYPES.UPDATE,
}) => {
  const delta =
    type === ACTIVITY_TYPES.REMOVE
      ? { taskName: entityNextState.taskName, assignee: entityNextState.assignee }
      : getUpdateDelta(entityPrevState, entityNextState);

  if (!isEmpty(delta)) {
    const detailsData = {
      ...delta,
      createdByType,
      partyId: entityPrevState.partyId,
      id: entityNextState.id,
      taskCategory,
    };

    await saveLog(req, { detailsData, type, component });
  }
};

export const getComponentTypeForComm = commType => {
  switch (commType) {
    case DALTypes.CommunicationMessageType.EMAIL:
      return COMPONENT_TYPES.EMAIL;
    case DALTypes.CommunicationMessageType.SMS:
      return COMPONENT_TYPES.SMS;
    case DALTypes.CommunicationMessageType.CALL:
      return COMPONENT_TYPES.CALL;
    case DALTypes.CommunicationMessageType.DIRECT_MESSAGE:
      return COMPONENT_TYPES.DIRECT_MESSAGE;
    default:
      return 'COMM';
  }
};

export const getActivityLogDetailsForNewComm = req => async comm => {
  if (comm.direction === DALTypes.CommunicationDirection.IN) {
    const guests = await getPersonsDisplayNamesByIds(req, comm.persons);
    if (comm.type === DALTypes.CommunicationMessageType.DIRECT_MESSAGE) {
      return [
        {
          comm,
          details: {
            from: guests,
            commDirection: comm.direction,
          },
          activityType: ACTIVITY_TYPES.NEW,
        },
      ];
    }
    if (comm.type !== DALTypes.CommunicationMessageType.CALL) return [];

    return [
      {
        comm,
        details: {
          from: guests,
          fromNumber: comm.message.from,
          to: comm.message.to && comm.message.to[0],
          commDirection: comm.direction,
        },
        activityType: ACTIVITY_TYPES.NEW,
      },
    ];
  }
  const guests = await getPersonsDisplayNamesByIds(req, comm.persons);
  if (comm.type === DALTypes.CommunicationMessageType.CALL) {
    return [
      {
        comm,
        activityType: ACTIVITY_TYPES.NEW,
        details: { to: guests, toNumber: comm.message.toNumber, fromNumber: comm.message.fromNumber, commDirection: comm.direction },
      },
    ];
  }

  return [
    {
      comm,
      activityType: ACTIVITY_TYPES.NEW,
      details: { to: guests, subject: comm.message.subject },
    },
  ];
};
const getRingDuration = comm =>
  comm.message?.rawMessage?.SessionStart && getDurationBetweenMoments(toMoment(comm.message.rawMessage?.SessionStart), toMoment(comm.updated_at));

export const getActivityLogDetailsForCommUpdate = delta => req => async comm => {
  if (comm.type === DALTypes.CommunicationMessageType.CALL) {
    if (delta.isCallTerminated && delta.message && !comm.message?.wasTransferred) {
      if (delta.message && !delta.message.isMissed && !delta.message.isDeclined && delta.message.duration !== '00:00') {
        return [
          {
            comm,
            details: {
              status: DALTypes.CallTerminationStatus.CLEARED,
              callDuration: comm.message.duration,
              ringDuration: getRingDuration(comm),
              commAgent: comm.userId,
            },
            activityType: ACTIVITY_TYPES.TERMINATED,
          },
        ];
      }
      if (
        (delta.message.isMissed && comm.direction === DALTypes.CommunicationDirection.IN) ||
        delta.message.isDeclined ||
        (comm.direction === DALTypes.CommunicationDirection.OUT && delta.message.duration === '00:00')
      ) {
        return [
          {
            comm,
            details: {
              status: delta.message.isDeclined ? DALTypes.CallTerminationStatus.DECLINED : DALTypes.CallTerminationStatus.MISSED,
              ringDuration: getRingDuration(comm),
            },
            activityType: ACTIVITY_TYPES.TERMINATED,
          },
        ];
      }
    }
    if (delta.message?.listened) {
      const guests = await getPersonsDisplayNamesByIds(req, comm.persons);
      const recordingType = comm.message.isVoiceMail ? 'Voice message' : 'Call recording';
      const guestsDirection = comm.direction === DALTypes.CommunicationDirection.IN ? 'from' : 'to';
      return [
        {
          comm,
          details: { [guestsDirection]: guests, recordingType },
          activityType: ACTIVITY_TYPES.LISTENED,
        },
      ];
    }
    if (comm.message?.wasTransferred && delta.message.duration && !delta.isCallTerminated) {
      return [
        {
          comm,
          details: {
            to: comm.message.transferTargetValue,
            status: DALTypes.CallTerminationStatus.TRANSFERRED,
            ringDuration: getRingDuration(comm),
            callDuration: delta.message.duration,
          },
          activityType: ACTIVITY_TYPES.TERMINATED,
        },
      ];
    }
    if (delta.message?.notes) {
      return [
        {
          comm,
          details: { notes: delta.message.notes },
          activityType: ACTIVITY_TYPES.UPDATE,
        },
      ];
    }
  }

  if (comm.direction === DALTypes.CommunicationDirection.OUT) return [];

  if (delta.unread === false && (comm.type === DALTypes.CommunicationMessageType.SMS || comm.type === DALTypes.CommunicationMessageType.EMAIL)) {
    const guests = await getPersonsDisplayNamesByIds(req, comm.persons);
    return [
      {
        comm,
        details: { from: guests },
        activityType: ACTIVITY_TYPES.READ,
      },
    ];
  }
  return [];
};

export const updatePartyActivity = async (ctx, comms, getCommDetails) => {
  const commsDetails = flatten(await mapSeries(comms, getCommDetails(ctx)));

  const log = ({ comm, details, activityType }) =>
    mapSeries(comm.parties, partyId =>
      logEntity(ctx, { entity: { partyId, id: comm.id, ...details }, activityType, component: getComponentTypeForComm(comm.type) }),
    );

  return await mapSeries(commsDetails, log);
};

const enhanceActivityLogDetails = async (ctx, activityLog) => {
  if (activityLog.component === COMPONENT_TYPES.QUOTE) {
    const { inventoryId, unitShortHand: unitShortHandStored } = activityLog.details;
    if (!unitShortHandStored && !inventoryId) return activityLog;

    const unitShortHand = unitShortHandStored || (await getShortFormatRentableItem(ctx, inventoryId));
    return {
      ...activityLog,
      details: {
        ...activityLog.details,
        unitShortHand,
      },
    };
  }
  return activityLog;
};

export const getActivityLogsByParty = async (ctx, partyId) => {
  const activityLogs = await getActivityLogsByPartyFromDb(ctx, partyId);
  if (isRevaAdmin(ctx.authUser)) return await execConcurrent(activityLogs, async activityLog => await enhanceActivityLogDetails(ctx, activityLog));
  const { id: revaAdminId } = await getRevaAdmin(ctx);
  const filteredActivityLogs = activityLogs.filter(log => !log.context.users.find(id => id === revaAdminId));
  return await execConcurrent(filteredActivityLogs, async activityLog => await enhanceActivityLogDetails(ctx, activityLog));
};

export const getActivityLogById = async (tenantId, id) => await getActivityLogByIdFromDb({ tenantId }, id);
