/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniqBy from 'lodash/uniqBy';
import sortBy from 'lodash/sortBy';
import { initQuery, rawStatement, getOne, insertInto } from '../database/factory';
import { DALTypes } from '../../common/enums/DALTypes';
import { COMPONENT_TYPES } from '../../common/enums/activityLogTypes';

const getActivityLogsDisplayNumbers = activitylogs => {
  const sortedLogs = sortBy(activitylogs, log => log.details.seqDisplayNo);
  return Object.values(COMPONENT_TYPES).reduce((acc, type) => {
    const sortedLogsByType = sortedLogs.filter(l => l.component === type);
    acc[type] = uniqBy(sortedLogsByType, log => log.details.seqDisplayNo).reduce((accByType, elem, index) => {
      accByType[elem.details.seqDisplayNo] = index + 1;
      return accByType;
    }, {});
    return acc;
  }, {});
};

const enhanceLogsWithDisplayNo = logs => {
  const activityLogsDisplayNumbersObject = getActivityLogsDisplayNumbers(logs);
  return logs.reduce((acc, elem) => {
    const displayNo = activityLogsDisplayNumbersObject[elem.component][elem.details.seqDisplayNo];

    acc.push({ ...elem, details: { ...elem.details, displayNo } });
    return acc;
  }, []);
};

export const saveActivityLog = (ctx, activityLog) => insertInto(ctx.tenantId, 'ActivityLog', activityLog, { outerTrx: ctx.trx });

// knex used as query builder
// eslint-disable-next-line
export const getActivityLogs = ctx =>
  initQuery(ctx)
    .from('ActivityLog')
    .orderBy('created_at', 'desc');

export const getActivityLogsByParty = async (ctx, partyId) => {
  const logs = await getActivityLogs(ctx).whereRaw(`"ActivityLog"."context" -> 'parties' @> '"${partyId}"'`);
  return enhanceLogsWithDisplayNo(logs);
};

export const getLastActivityLogsByPartyForUsers = async (ctx, partyId) => {
  const orderedPartyLogs = await getActivityLogsByParty(ctx, partyId);
  const usersLogs = orderedPartyLogs.filter(l => l.details.createdByType === DALTypes.CreatedByType.USER && l.context.users.length);
  const usersLastActivityLogs = uniqBy(usersLogs, l => l.context.users[0]);
  return usersLastActivityLogs;
};

export const getActivityLogById = async (ctx, id) => await getOne({ tenantId: ctx.tenantId }, 'ActivityLog', id);

export const getActLogDisplayNo = async ctx => {
  const query = 'SELECT (last_value)::int AS "seqDisplayNo" FROM db_namespace."activityLogDisplayNoSeq"';
  const result = await rawStatement(ctx, query);
  const { seqDisplayNo } = result.rows[0];

  return seqDisplayNo;
};

const getNextActLogDisplayNo = async ctx => {
  const query = 'SELECT nextval(\'db_namespace."activityLogDisplayNoSeq"\')::int AS "seqDisplayNo"';
  const result = await rawStatement(ctx, query);
  const { seqDisplayNo } = result.rows[0];

  return seqDisplayNo;
};

export const getDisplayNoData = async (ctx, partyId, component, entityId) => {
  const logs = await initQuery(ctx)
    .from('ActivityLog')
    .where({ component })
    .andWhereRaw(`"ActivityLog"."context" -> 'parties' @> '"${partyId}"'`)
    .orderByRaw("cast(details ->> 'seqDisplayNo' as int) desc");

  const existingLogForEntity = logs.find(l => l.details.id === entityId);
  if (existingLogForEntity) {
    return {
      seqDisplayNo: existingLogForEntity.details.seqDisplayNo,
      merged: existingLogForEntity.details.merged,
    };
  }
  const seqDisplayNo = await getNextActLogDisplayNo(ctx);

  return { seqDisplayNo };
};

export const getDeclineNotesByPartyId = async (ctx, partyId) => {
  const query = `
  SELECT 
  act.id, act.created_at, act.details->'notes' as notes , u."fullName" as user from db_namespace."ActivityLog" act
    INNER JOIN db_namespace."Users" u ON u.id::text =  act."context"->'users'->>0
    WHERE act."type" = 'decline' AND act.component = 'application' 
    AND act.context->'parties'@> '"${partyId}"' 
  `;
  return await rawStatement(ctx, query);
};
