/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { literal } from 'pg-format';
import uniq from 'lodash/uniq';
import chunk from 'lodash/chunk';
import { mapSeries } from 'bluebird';
import { knex } from '../../server/database/factory';
import { getCollaboratorsForParties } from '../../server/dal/partyRepo';
import { getUsersWithAssignedTasksForParties } from '../../server/dal/tasksRepo';
import eventTypes from '../enums/eventTypes';
import { ChannelNames } from '../enums/ws';
import loggerInstance from '../helpers/logger';
import { shortenedToString } from '../helpers/strings';
import { assertLog } from '../assert';
import { obscureObject } from '../helpers/logger-utils';
import { sanitizeData } from '../helpers/socket';

const logger = loggerInstance.child({ subType: 'ws' });
const NOTIFY_BYTES_LIMIT = 8000;
const NOTIFY_BYTES_LIMIT_WARNING = NOTIFY_BYTES_LIMIT - 1000;
const STRING_ENCODING = 'utf8';

export const RESIDENTS = 'residents';

const logNotifyLimit = (ctx, channel, payload, logMessage) => {
  logger.error({ ctx, tenantId: channel, notifyMessage: literal(JSON.stringify(obscureObject(payload))) }, logMessage);
};

export const publish = async (ctx = {}, channel, payload) => {
  const msg = literal(JSON.stringify(payload));
  const escapedMsg = msg.replace(/\?/g, '\\?');
  const byteLength = Buffer.byteLength(escapedMsg, STRING_ENCODING);

  if (byteLength > NOTIFY_BYTES_LIMIT) {
    logNotifyLimit(ctx, channel, payload, 'Notify payload limit exceeded');
  } else {
    if (byteLength > NOTIFY_BYTES_LIMIT_WARNING) {
      logNotifyLimit(ctx, channel, payload, 'Notify payload is close to the size limit');
    }

    await knex.raw(`NOTIFY "${channel}", ${escapedMsg}`);
  }
};

const getAdditionalWSUsers = async (ctx, partyIds) => {
  if (ctx.tenantId === RESIDENTS) return [];
  const collaborators = await getCollaboratorsForParties(ctx, partyIds);
  const usersWithTasks = (await getUsersWithAssignedTasksForParties(ctx, partyIds)) || [];
  return uniq([...collaborators, ...usersWithTasks]);
};

const defaultNotificationFunc = async ({ ctx = {}, event, data, routing }, eventType = eventTypes.BROADCAST) => {
  const { tenantId, trx } = ctx;

  assertLog(tenantId, logger, 'Missing tenantId on notify');
  assertLog(event, logger, 'Missing event on notify');

  const usersToLog = routing?.users?.length > 10 ? shortenedToString(routing?.users, 1500) : shortenedToString(routing?.users);
  const teamsToLog = routing?.teams?.length > 10 ? shortenedToString(routing?.teams, 1500) : shortenedToString(routing?.teams);
  const routingToLog = { ...routing, users: usersToLog, teams: teamsToLog };
  const notificationOp = async () => {
    logger.trace(
      { ctx, tenantId, event, wsNotificationData: shortenedToString(sanitizeData(data), 2000), wsRouting: routingToLog },
      `Publishing ws notification to tenant channel ${tenantId}`,
    );

    const { reqId } = ctx;

    let routingPayload = routing;
    if (routing) {
      const { teams, ...rest } = routing;
      if (teams && teams.length) {
        routingPayload = { ...rest, teams: uniq(teams) };
      }
    }

    const { partyId, partyIds } = data || {};

    let payload = { ...(data || {}), reqId };
    if (partyId) {
      const wsUsers = await getAdditionalWSUsers({ tenantId }, [partyId]);
      payload = { ...payload, wsUsers };
    }

    if (partyIds) {
      const wsUsers = await getAdditionalWSUsers({ tenantId }, partyIds);
      payload = { ...payload, wsUsers };
    }

    if (payload.wsUsers && !(routingPayload?.users || []).length) {
      routingPayload = { ...routingPayload, users: payload.wsUsers };
    }

    if (routingPayload?.users?.length > 50) {
      await mapSeries(chunk(routingPayload?.users || [], 50), async batch => {
        const batchedRouting = { ...routingPayload, users: batch };
        const eventData = { eventType, event, routing: batchedRouting, data: payload };
        await publish(ctx, tenantId, eventData);
      });
    } else {
      await publish(ctx, tenantId, { eventType, event, routing: routingPayload, data: payload });
    }
  };

  if (!trx || (trx.isCompleted && trx.isCompleted())) {
    await notificationOp();
    return;
  }

  logger.trace({ ctx, tenantId, event, trxId: trx.trxId }, 'delaying notification until transaction commit');
  trx.addPostCommitOperation(notificationOp);
};

let notificationFunc = defaultNotificationFunc;

const getNotificationFunction = () => notificationFunc;

export const setNotificationFunction = func => {
  notificationFunc = func;
};
export const resetNotificationFunction = () => {
  notificationFunc = defaultNotificationFunc;
};

export const notify = (...args) => getNotificationFunction()(...args);

export const notifyAll = async ({ ctx, event, data }) => {
  logger.trace({ ctx, event, data }, 'Publishing ws notification to all');
  await publish(ctx, ChannelNames.ALL, { event, data });
};
