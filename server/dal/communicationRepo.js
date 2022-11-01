/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { computeThreadId } from '../../common/helpers/utils';
import { BouncedCommunicationStatuses } from '../../common/helpers/party-utils';
import { DALTypes } from '../../common/enums/DALTypes';
import { adjustWalkinDates } from '../../common/helpers/walkInUtils';
import config from '../config';
import { initQuery, insertInto, update, updateJsonColumn, rawStatement } from '../database/factory';
import { toMoment } from '../../common/helpers/moment-utils';
import { obscureObject } from '../../common/helpers/logger-utils';
import loggerModule from '../../common/helpers/logger';
import { getTenantByName } from '../services/tenantService';

const logger = loggerModule.child({ subtype: 'communicationRepo' });

export const storeMessage = async (ctx, communication) => {
  const communicationEntry = {
    id: newId(),
    ...communication,
    threadId: communication.threadId || computeThreadId(communication.type, communication.persons),
  };
  return await insertInto(ctx.tenantId, 'Communication', communicationEntry, { outerTrx: ctx.trx });
};

export const getCommunicationsForPartyByCategory = async (ctx, partyId, category) => {
  logger.trace({ ctx, partyId, category }, 'getCommunicationsForPartyByCategory');

  const query = `
    SELECT *
    FROM db_namespace."Communication"
    WHERE :partyId = any(parties)
    AND category = :category
    ORDER BY created_at DESC
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId, category }]);

  return rows;
};

export const updateDraftById = async (ctx, id, delta) => {
  logger.trace({ ctx, id, delta }, 'updateDraftById');
  const [draft] = await initQuery(ctx)
    .from('CommunicationDrafts')
    .where({ id })
    .update({
      ...delta,
      recipients: updateJsonColumn(ctx, 'recipients', delta.recipients),
      data: updateJsonColumn(ctx, 'data', delta.data),
    })
    .returning('*');
  return draft;
};

export const deleteDraftById = async (ctx, id) => {
  logger.trace({ ctx, id }, 'deleteDraftById');
  return await initQuery(ctx).from('CommunicationDrafts').where({ id }).del();
};

export const storeDraft = async (ctx, draft) => {
  logger.trace({ ctx, draft }, 'storeDraft');
  const draftEntry = {
    id: draft.id || newId(),
    userId: draft.userId,
    partyId: draft.partyId,
    type: draft.type,
    recipients: draft.recipients,
    data: draft.message,
    threadId: draft.threadId,
  };

  return draft.id ? await updateDraftById(ctx, draft.id, draftEntry) : await insertInto(ctx.tenantId, 'CommunicationDrafts', draftEntry, { outerTrx: ctx.trx });
};

export const getDraftsForUserAndParty = async (ctx, userId, partyId) =>
  await initQuery(ctx).from('CommunicationDrafts').where({ partyId, userId }).orderBy('updated_at', 'asc').select('*');

export const getLastEmail = async ctx =>
  await initQuery(ctx).from('Communication').where({ type: 'Email', direction: 'out' }).orderBy('created_at', 'desc').limit(1).select('*');

export const getCommunicationsForParty = async (
  ctx,
  partyId,
  { type = DALTypes.CommunicationMessageType.EMAIL, direction = DALTypes.CommunicationDirection.OUT },
) => {
  const query = `
    SELECT *
    FROM db_namespace."Communication"
    WHERE :partyId = any(parties)
    AND direction = :direction AND type = :type
    ORDER BY created_at DESC
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId, direction, type }]);

  return rows;
};

export const loadMessageById = async (ctx, id) => await initQuery(ctx).from('Communication').where({ id }).first();

export const getLastIncomingEmail = async ctx =>
  await initQuery(ctx).from('Communication').where({ type: 'Email', direction: 'in' }).orderBy('created_at', 'desc').limit(1).select('*');

export const getAllComms = async ctx => {
  const { rows } = await rawStatement(ctx, 'SELECT * FROM db_namespace."Communication";');

  return rows;
};

export const getCommsByUserId = async (ctx, userId) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Communication"
      WHERE "userId" = :userId;`,
    [{ userId }],
  );

  return rows;
};

export const getCommsByType = async (ctx, type) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Communication"
      WHERE "type" = :type;`,
    [{ type }],
  );

  return rows;
};

export const getCommsByTransferredFrom = async (ctx, transferredFromCommId) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Communication"
      WHERE "transferredFromCommId" = :transferredFromCommId;`,
    [{ transferredFromCommId }],
  );

  return rows;
};

export const getCommsByMessageIdAndTransferredFrom = async (ctx, messageId, transferredFromCommId) => {
  const { rows } = await rawStatement(
    ctx,
    `SELECT * FROM db_namespace."Communication"
      WHERE "messageId" = :messageId AND "transferredFromCommId" = :transferredFromCommId;`,
    [{ messageId, transferredFromCommId }],
  );

  return rows;
};

export const loadLastMessage = async ctx => {
  const query = 'SELECT * FROM db_namespace."Communication" ORDER BY created_at DESC LIMIT 1';
  const {
    rows: [comm],
  } = await rawStatement(ctx, query);
  return [comm];
};

export const loadCallsByCallIds = async (ctx, callIds) => await initQuery(ctx).from('Communication').whereIn('messageId', callIds).select('*');

export const getAllVoiceRecordingIds = async ctx =>
  (await getCommsByType(ctx, DALTypes.CommunicationMessageType.CALL)).map(c => c.message.recordingId).filter(id => !!id);

export const getPostsAsCommsByColumnAndIds = async (ctx, column, ids) => {
  logger.trace({ ctx, column, ids }, 'getPostsAsCommsByColumnAndIds');

  const whereClause = column === 'partyIds' ? `pr."${column}" @> '{${ids}}'` : `pr."${column}" = '${ids}'`;

  const query = `
    SELECT
      pr.created_at,
      pr.updated_at,
      pr.id,
      "partyIds"::varchar[] as parties,
      string_to_array("personId"::varchar, ',') as persons,
      '${DALTypes.CommunicationDirection.OUT}' as direction,
      '${DALTypes.CommunicationMessageType.DIRECT_MESSAGE}' as type,
      p."sentBy" as "userId",
      p.id as "messageId",
      json_build_object('post', p.*) AS message,
      json_build_object('status', json_build_array(json_build_object('status', n.status))) as status,
      null as "threadId",
      null as teams,
      p.category as category,
      false as unread,
      null as "teamPropertyProgramId",
      null as "transferredFromCommId",
      null as "readBy",
      null as "readAt",
      null as "calledTeam",
      null as "partyOwner",
      null as "fallbackTeamPropertyProgramId"
    FROM db_namespace."PostRecipient" pr
    JOIN db_namespace."Post" p ON p.id = pr."postId"
    LEFT JOIN db_namespace."Notification" n on pr.id = n."postRecipientId"
    WHERE ${whereClause}
    AND pr.status = '${DALTypes.CommunicationStatus.SENT}'
    AND p."sentAt" IS NOT NULL
    `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

const loadCommunicationsByIdInArrayColumn = async (ctx, { column, ids, includeUndeliveredComms = false, categories } = {}) => {
  logger.trace(
    { ctx, column, ids, categories, includeUndeliveredComms, undeliveredCommunicationStatuses: BouncedCommunicationStatuses },
    'loadCommunicationsByIdInArrayColumn',
  );

  let query = initQuery(ctx)
    .from('Communication')
    .select('Communication.*', 'Sources.name as source')
    .leftJoin('TeamPropertyProgram', 'Communication.teamPropertyProgramId', 'TeamPropertyProgram.id')
    .leftJoin('Programs', 'TeamPropertyProgram.programId', 'Programs.id')
    .leftJoin('Sources', 'Programs.sourceId', 'Sources.id')
    .where(column, '&&', `{${ids}}`)
    .orderBy('updated_at', 'asc');

  query = includeUndeliveredComms
    ? query.andWhere(function whereConditions() {
        this.whereRaw(
          `"Communication"."type" <> '${DALTypes.CommunicationMessageType.EMAIL}' OR "category" = ANY( :categoriesParam) OR "category" LIKE 'Nurture%'`,
          {
            categoriesParam: [categories],
          },
        ).orWhereRaw(
          `ARRAY(SELECT (JSONB_ARRAY_ELEMENTS("Communication"."status" -> 'status') ->> 'status')) <@ ARRAY[${BouncedCommunicationStatuses.map(
            status => `'${status}'`,
          ).join(',')}]::text[] AND "Communication"."status" IS NOT NULL`,
        );
      })
    : query.andWhereRaw(
        `("Communication"."type" <> '${DALTypes.CommunicationMessageType.EMAIL}' OR "category" = ANY( :categoriesParam)) OR "category" LIKE 'Nurture%'`,
        {
          categoriesParam: [categories],
        },
      );

  return await query;
};

export const loadCommunicationsByPersonIds = (req, personIds, categories) =>
  loadCommunicationsByIdInArrayColumn(req, { column: 'persons', ids: personIds, categories: categories || config.defaultCommsCategories });

export const loadCommunicationsByPartyIds = (ctx, parties, categories) =>
  loadCommunicationsByIdInArrayColumn(ctx, { column: 'parties', ids: parties, categories: categories || config.defaultCommsCategories });

export const getCommunicationsByPartiesForCommsPanel = (ctx, parties, categories) =>
  loadCommunicationsByIdInArrayColumn(ctx, {
    column: 'parties',
    ids: parties,
    includeUndeliveredComms: true,
    categories: categories || config.defaultCommsCategories,
  });

const toDeltaWithJsonUpdates = (ctx, delta) => ({
  ...delta,
  message: updateJsonColumn(ctx, 'message', delta.message),
  status: updateJsonColumn(ctx, 'status', delta.status),
});

export const updateMessages = async (ctx, query, delta) => {
  logger.trace({ ctx, delta }, 'updateMessages');

  return await update(ctx, 'Communication', query, toDeltaWithJsonUpdates(ctx, delta));
};

export const updateCommunicationEntryById = async (ctx, id, delta) => {
  logger.trace({ ctx, id, delta: obscureObject(delta) }, 'updateCommunicationEntryById');

  const [comm] = await initQuery(ctx).from('Communication').where({ id }).update(toDeltaWithJsonUpdates(ctx, delta)).returning('*');
  return comm;
};

export const updateCommsWithoutOwnerIds = async (ctx, partyId, userId) => {
  const query = `
    UPDATE db_namespace."Communication"
      SET "partyOwner" = :userId
      WHERE :partyId = ANY(parties)
      AND "partyOwner" IS NULL;`;

  await rawStatement(ctx, query, [{ partyId, userId }]);
};

export const updateCommunicationEntriesByIds = async (ctx, ids, delta) => {
  logger.trace({ ctx, ids, delta }, 'updateCommunicationEntriesByIds');
  return await initQuery(ctx).from('Communication').whereIn('id', ids).update(toDeltaWithJsonUpdates(ctx, delta)).returning('*');
};

export const updateCommunicationEntriesForParties = async (ctx, parties, delta) => {
  logger.trace({ ctx, parties, delta }, 'updateCommunicationEntriesForParties');
  return await initQuery(ctx).from('Communication').where('parties', '&&', `{${parties}}`).update(toDeltaWithJsonUpdates(ctx, delta)).returning('*');
};

export const getCommunicationByMessageId = async (ctx, messageId) => {
  const query = `
    SELECT id, created_at, status, message, "threadId", type
    FROM db_namespace."Communication"
    WHERE "messageId" = :messageId
  `;

  const { rows } = await rawStatement(ctx, query, [{ messageId }]);
  return rows[0];
};

export const getCommunicationsByMessageId = async (ctx, messageId) => await initQuery(ctx).from('Communication').where({ messageId });

const getLastCommunicationDate = comms => {
  if (!comms.length) return '';

  const adjustedComms = adjustWalkinDates(comms);
  const sortedComms = adjustedComms.sort((a, b) => toMoment(b.created_at).diff(toMoment(a.created_at)));
  return sortedComms[0].created_at;
};

export const getPersonLastContactedDate = async (ctx, personId) => {
  const commsForPerson = await loadCommunicationsByPersonIds(ctx, personId);
  return getLastCommunicationDate(commsForPerson);
};

export const getPartyLastContactedDate = async (ctx, partyId) => {
  const commsForParty = await loadCommunicationsByPartyIds(ctx, partyId);
  return getLastCommunicationDate(commsForParty);
};

export const loadCommsByThreadId = async (ctx, threadId) => {
  const { rows } = await rawStatement(ctx, 'SELECT * FROM db_namespace."Communication" WHERE "threadId" = :threadId;', [{ threadId }]);

  return rows;
};

export const getContactEventsByPartyAndFilter = async (ctx, partyId, { type, importCommDateTime, text }) => {
  let query = initQuery(ctx)
    .from('Communication')
    .where({ type: DALTypes.CommunicationMessageType.CONTACTEVENT })
    .andWhere('parties', '&&', `{${partyId}}`)
    .orderBy('updated_at', 'desc');

  query = type ? query.andWhereRaw('"Communication"."message"->>\'type\' = ?', [type]) : query;
  query = importCommDateTime ? query.andWhereRaw('"Communication"."message"->>\'importCommDateTime\' = ?', [importCommDateTime]) : query;
  query = text ? query.andWhereRaw('"Communication"."message"->>\'text\' = ?', [text]) : query;

  return await query;
};

export const getCommunicationsByIds = async (ctx, ids) => await initQuery(ctx).from('Communication').whereIn('id', ids);

const getCommWithSourceQuery = `
  SELECT comm.*, sources.name AS source
    FROM db_namespace."Communication" comm
    LEFT JOIN db_namespace."TeamPropertyProgram" teamPropertyProgram ON comm."teamPropertyProgramId" = teamPropertyProgram.id
    LEFT JOIN db_namespace."Programs" programs ON teamPropertyProgram."programId" = programs.id
    LEFT JOIN db_namespace."Sources" sources ON sources.id = programs."sourceId"`;

export const getUnreadCommunicationsWithSourceByThreadId = async (ctx, threadId) => {
  const query = `${getCommWithSourceQuery}
    WHERE comm."threadId" = :threadId
    AND comm.unread IS TRUE`;

  const { rows } = await rawStatement(ctx, query, [{ threadId }]);
  return rows;
};

export const markCommsAsReadForPartyByUser = async (ctx, partyId, userId) => {
  const query = `
    UPDATE db_namespace."Communication" as comms
    SET unread = FALSE,
      "readBy" = :userId,
      "readAt" = now()
    WHERE :partyId = any(comms.parties)
    AND comms.unread IS TRUE
    RETURNING comms.*;
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId, userId }]);

  return rows;
};

export const loadCommunicationsWithSourceByIdsForParties = async (ctx, parties, ids) => {
  const query = `${getCommWithSourceQuery}
    WHERE ARRAY[comm.id] <@ :ids
    AND comm.parties && :parties
    ORDER BY comm.updated_at ASC
  `;

  const { rows } = await rawStatement(ctx, query, [{ ids, parties: `{${parties}}` }]);
  return rows;
};

export const getIncomingCommunicationsStats = async (ctx, msgTypes, interval = '2 hours') => {
  if (!(msgTypes && msgTypes.length)) {
    msgTypes = Object.keys(DALTypes.CommunicationMessageType).map(key => DALTypes.CommunicationMessageType[key]);
  }

  const incomingCommsTotalsPerMsgTypeCols = msgTypes
    .map(type => {
      const columnName = `${type.charAt(0).toLowerCase() + type.slice(1)}Total`;
      return `COUNT(CASE WHEN "type" = '${type}' THEN 1 END)::integer AS "${columnName}"`;
    })
    .join(',');

  const query = `
    SELECT
      ${incomingCommsTotalsPerMsgTypeCols}
    FROM db_namespace."Communication"
    WHERE
      direction = :direction
      AND created_at > NOW() - INTERVAL '${interval}'
  `;

  const { rows } = await rawStatement(ctx, query, [{ direction: DALTypes.CommunicationDirection.IN }]);
  const [results] = rows;
  return results;
};

export const saveUnreadCommunication = async (ctx, partyId, communication) => {
  logger.trace({ ctx, partyId, communicationId: communication.id }, 'saveUnreadCommunication');
  const query = `
    INSERT INTO db_namespace."UnreadCommunication"
    (id, "communicationCreatedAt", "partyId", "communicationData", "communicationId")
    values ( "public".gen_random_uuid(), :communicationCreatedAt, :partyId, :communication, :communicationId )
    ON CONFLICT ("partyId", "communicationId")
    DO
		UPDATE
	  SET "communicationData" = :communication;
  `;

  const { rows } = await rawStatement(ctx, query, [
    { communicationCreatedAt: communication.created_at, partyId, communication, communicationId: communication.id },
  ]);

  return rows;
};

export const removeUnreadCommunications = async (ctx, communicationIds) => {
  logger.trace({ ctx, communicationIds }, 'removeUnreadCommunications');
  const query = `
  DELETE FROM db_namespace."UnreadCommunication" uc
  WHERE ARRAY["communicationId"::varchar(50)] <@ :communicationIds`;

  const { rows } = await rawStatement(ctx, query, [{ communicationIds }]);

  return rows;
};

export const removeUnreadCommunicationsByIds = async (ctx, unreadCommunicationIds) => {
  logger.trace({ ctx, unreadCommunicationIds }, 'removeUnreadCommunicationsByIds');
  const query = `
  DELETE FROM db_namespace."UnreadCommunication" uc
  WHERE ARRAY["id"::varchar(50)] <@ :unreadCommunicationIds`;

  const { rows } = await rawStatement(ctx, query, [{ unreadCommunicationIds }]);

  return rows;
};

export const getUnreadCommunicationsByPartyId = async (ctx, partyId) => {
  const query = `
    SELECT *
    FROM db_namespace."UnreadCommunication"
    WHERE "partyId" = :partyId
  `;

  const { rows } = await rawStatement(ctx, query, [{ partyId }]);
  return rows;
};

export const getDirectMessagesByPersonIdAndPartyIds = async (ctx, personId, partyIds) => {
  logger.trace({ ctx, personId, partyIds }, 'getDirectMessagesByPersonIdAndPartyIds');

  const query = `
    SELECT *
    FROM db_namespace."Communication"
    WHERE :personId = any(persons)
    AND type = '${DALTypes.CommunicationMessageType.DIRECT_MESSAGE}'
    AND parties <@ :partyIds
    ORDER BY "updated_at" DESC;
  `;

  const { rows } = await rawStatement(ctx, query, [{ personId, partyIds }]);
  return rows;
};

export const personWasNotifiedToday = async (ctx, personId, propertyId) => {
  logger.trace({ ctx, personId, propertyId }, 'personWasNotifiedToday');

  const query = `
    SELECT EXISTS (
      SELECT 1
          FROM db_namespace."DirectMessageNotification" dmn
          INNER JOIN db_namespace."Communication" c ON c.id = dmn."communicationId"
          INNER JOIN db_namespace."Property" p ON p.id = dmn."propertyId"
          WHERE :personId = ANY(c.persons)
          AND c.type = :directMessage
          AND dmn."propertyId" = :propertyId
          AND c.direction = :messageDirection
          AND dmn.created_at::timestamp AT TIME ZONE p.timezone >= current_date::timestamp AT TIME ZONE p.timezone);`;

  const { rows } = await rawStatement(ctx, query, [
    { personId, directMessage: DALTypes.CommunicationMessageType.DIRECT_MESSAGE, messageDirection: DALTypes.CommunicationDirection.OUT, propertyId },
  ]);

  return rows[0]?.exists;
};

export const getUnreadMessagesByPersonIdAndPropertyIds = async (ctx, personId, propertyIds) => {
  logger.trace({ ctx, personId, propertyIds }, 'getUnreadMessagesByPersonIdAndPropertyIds');

  const query = `
    SELECT party."assignedPropertyId" AS "propertyId", count(*) FROM db_namespace."Communication" comm
      JOIN db_namespace."Party" party ON party.id = ANY (comm.parties::uuid[])
    WHERE :personId = ANY(comm."persons")
      AND party."assignedPropertyId" = ANY (:propertyIds)
      AND comm.type = '${DALTypes.CommunicationMessageType.DIRECT_MESSAGE}'
      AND comm.direction = '${DALTypes.CommunicationDirection.OUT}'
      AND comm.unread IS TRUE
    GROUP BY
      party."assignedPropertyId";
  `;

  const { rows } = await rawStatement(ctx, query, [{ personId, propertyIds }]);
  return rows;
};

export const getDirectMessageThreadIdByPartiesAndPersons = async (ctx, parties, persons) => {
  logger.trace({ ctx, parties, persons }, 'getDirectMessageThreadIdByPartiesAndPersons');

  const query = `
    SELECT "threadId" FROM db_namespace."Communication" comm
    WHERE comm.parties && :parties
      AND comm.persons && :persons
      AND comm.type = '${DALTypes.CommunicationMessageType.DIRECT_MESSAGE}'
    LIMIT 1
  `;

  const { rows } = await rawStatement(ctx, query, [{ parties, persons }]);

  return rows.length ? rows[0] : {};
};

export const loadLastCommunicationDateByPersonIds = async (ctx, personIds) => {
  const query = `
              SELECT  comms."personId",
              MAX(comms.created_at) as "commDate"
                 FROM (
                      SELECT UNNEST(persons) AS "personId", created_at
                      FROM db_namespace."Communication"
                      WHERE  persons && '{${personIds}}'
                      ) comms
              GROUP BY comms."personId";
                        `;
  const { rows = [] } = await rawStatement(ctx, query);

  return rows;
};

export const getPersonsLastContactedDate = async (ctx, personIds) => {
  const comms = await loadLastCommunicationDateByPersonIds(ctx, personIds);
  const groupedCommsByPersonId = comms.reduce((acc, comm) => {
    acc[comm.personId] = comm.commDate;
    return acc;
  }, {});
  return groupedCommsByPersonId;
};

export const getCommByS3Key = async (tenantName, key) => {
  const tenant = await getTenantByName(tenantName);

  const query = `
    SELECT 1 
      FROM db_namespace."Communication"
      WHERE type = :emailType AND direction = :direction AND created_at >= NOW() - INTERVAL '24 HOURS'
      AND message->'rawMessage'->'headers'->>'received'::text LIKE '%${key}%';`;

  const { rows = [] } = await rawStatement({ tenantId: tenant.id }, query, [
    { emailType: DALTypes.CommunicationMessageType.EMAIL, direction: DALTypes.CommunicationDirection.IN },
  ]);

  return rows.length > 0;
};
