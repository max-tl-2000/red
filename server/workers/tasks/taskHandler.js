/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { flattenDeep, uniq, pick, omit } from 'lodash'; // eslint-disable-line red/no-lodash

import { taskDefinitions } from './taskDefinitions/taskDefinitions';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { runInTransaction } from '../../database/factory';
import { loadPartyById } from '../../dal/partyRepo';
import { getPartiesWithAllowedTasks } from './utils';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subtype: 'TaskHandler' });

const getAllowedPartyIdsByTaskName = (taskName, partiesWithAllowedTasks = []) =>
  partiesWithAllowedTasks.filter(apt => !apt.isCorporateParty || apt.tasks.some(t => t === taskName)).map(apt => apt.partyId);

export const processTasks = async msg => {
  const { tasks, partyIds, metadata, userId, tenantId, msgCtx } = msg;
  const hasPartyIds = !!(partyIds && partyIds.length);
  const taskLogData = pick(msg, ['tasks', 'partyIds', 'userId', 'tenantId', 'routingKey', 'reqId', 'msgId', 'id']);
  logger.time({ ctx: msgCtx }, 'Recurring Jobs - Processing tasks duration');
  logger.trace({ ...omit(taskLogData, ['id']), taskId: taskLogData.id }, 'processing tasks');

  try {
    const ctx = { ...msgCtx, tenantId, userId };

    const tasksDefinitionsToProcess = taskDefinitions.filter(p => tasks.some(x => x === p.name));
    const partiesWithAllowedTasks =
      (hasPartyIds &&
        (await getPartiesWithAllowedTasks(
          ctx,
          partyIds,
          tasksDefinitionsToProcess.map(task => task.name),
        ))) ||
      [];

    const processedTasks = await mapSeries(tasksDefinitionsToProcess, async td => {
      if (!hasPartyIds) await td.processTaskDefinition(ctx, partyIds, metadata);
      const allowedPartyIds = getAllowedPartyIdsByTaskName(td.name, partiesWithAllowedTasks);
      if (!allowedPartyIds.length) return null;
      return await td.processTaskDefinition(ctx, allowedPartyIds, metadata);
    });

    const notificationItems = uniq(
      flattenDeep(processedTasks)
        .filter(task => task)
        .map(task => ({ taskId: task.id, partyId: task.partyId })),
    );

    logger.debug({ ctx: msgCtx }, 'TaskHandler - ids for notification', notificationItems);

    if (notificationItems.length) {
      const eligiblePartyIds = hasPartyIds ? notificationItems.map(task => task.partyId) : partyIds;
      const uniqPartyIds = uniq(eligiblePartyIds);
      const parties = await mapSeries(uniqPartyIds, async partyId => await loadPartyById({ tenantId }, partyId));
      const teams = uniq(flattenDeep(parties.map(party => party.teams)));

      notify({
        ctx,
        event: eventTypes.PROCESS_TASK_EVENT,
        data: { tasks: notificationItems, partyIds: uniqPartyIds },
        routing: { teams },
      });
    }
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'TaskHandler.processTasks');
  }

  logger.timeEnd({ ctx: msgCtx }, 'Recurring Jobs - Processing tasks duration');

  return { processed: true };
};

export const markTasksCompleted = async msg => {
  const { tasks, partyIds, metadata, userId, tenantId, msgCtx } = msg;
  const hasPartyIds = !!(partyIds && partyIds.length);
  logger.trace({ ctx: msgCtx, tasks, partyIds, metadata, userId, tenantId }, 'markTasksCompleted');

  try {
    await runInTransaction(async trx => {
      const ctx = { ...msgCtx, tenantId, userId, trx };

      const tasksDefinitionsToProcess = taskDefinitions.filter(p => tasks.some(x => x === p.name));
      const partiesWithAllowedTasks =
        (hasPartyIds &&
          (await getPartiesWithAllowedTasks(
            ctx,
            partyIds,
            tasksDefinitionsToProcess.map(task => task.name),
          ))) ||
        [];

      const processedTasks = await mapSeries(tasksDefinitionsToProcess, async td => {
        if (!hasPartyIds) await td.markTasksCompleted(ctx, partyIds, metadata);
        const allowedPartyIds = getAllowedPartyIdsByTaskName(td.name, partiesWithAllowedTasks);
        if (!allowedPartyIds.length) return null;
        return await td.markTasksCompleted(ctx, allowedPartyIds, metadata);
      });

      const taskIdsForNotification = uniq(
        flattenDeep(processedTasks)
          .filter(task => task)
          .map(task => ({ taskId: task.id, partyId: task.partyId })),
      );

      const uniqPartyIds = uniq(partyIds);
      const parties = await mapSeries(uniqPartyIds, async partyId => await loadPartyById({ tenantId }, partyId));
      // loadPartyById return undefined for a non existent party
      const teams = uniq(flattenDeep(parties.filter(party => !!party).map(party => party.teams)));

      logger.debug({ ctx }, 'TaskHandler - ids for notification', taskIdsForNotification);
      if (taskIdsForNotification.length) {
        notify({
          ctx,
          tenantId,
          trx,
          event: eventTypes.PROCESS_TASK_EVENT,
          data: { tasks: taskIdsForNotification, partyIds: uniqPartyIds },
          routing: { teams },
        });
      }
    });
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'TaskHandler.markTasksCompleted');
  }
  return { processed: true };
};

export const markTasksCanceled = async msg => {
  const { msgCtx, tasks, categoriesToExclude = [], skipAllowedTaskValidation, tenantId, partyId, authUser = {}, tenantSettings } = msg;
  logger.trace(
    { msgCtx, tasks, tenantId, partyId, authUser: { id: authUser.id, userEmail: authUser.userEmail, teamIds: authUser.teamIds } },
    'markTasksCanceled',
  );

  try {
    await runInTransaction(async trx => {
      const ctx = { ...msgCtx, tenantId, authUser, tenantSettings, trx };

      let tasksDefinitionsToProcess = tasks ? taskDefinitions.filter(p => tasks.some(x => x === p.name)) : taskDefinitions;
      tasksDefinitionsToProcess = tasksDefinitionsToProcess.filter(t => !categoriesToExclude.includes(t.category));
      const partiesWithAllowedTasks = await getPartiesWithAllowedTasks(
        ctx,
        [partyId],
        tasksDefinitionsToProcess.map(task => task.name),
      );

      const processedTasks = await mapSeries(tasksDefinitionsToProcess, async td => {
        if (skipAllowedTaskValidation) return await td.markTasksCanceled(ctx, partyId);
        const allowedPartyIds = getAllowedPartyIdsByTaskName(td.name, partiesWithAllowedTasks);

        if (!allowedPartyIds.length) return null;
        return await td.markTasksCanceled(ctx, allowedPartyIds[0]);
      });

      const taskIdsForNotification = uniq(
        flattenDeep(processedTasks)
          .filter(task => task)
          .map(task => ({
            taskId: task.id,
            partyId: task.partyId,
            canceled: true,
          })),
      );
      logger.debug({ ctx, taskIdsForNotification }, 'TaskHandler - ids for notification');

      if (taskIdsForNotification.length) {
        notify({
          ctx,
          tenantId,
          event: eventTypes.PROCESS_TASK_EVENT,
          data: { tasks: taskIdsForNotification, partyIds: uniq(taskIdsForNotification.map(({ partyId: taskPartyId }) => taskPartyId)) },
        });
      }
    });
  } catch (error) {
    logger.error({ ctx: msgCtx, error }, 'TaskHandler.markTasksCanceled');
  }
  return { processed: true };
};
