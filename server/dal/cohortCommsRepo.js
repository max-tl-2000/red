/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import { rawStatement, insertInto } from '../database/factory';
import loggerModule from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';
import typeOf from '../../common/helpers/type-of';
import nullish from '../../common/helpers/nullish';

const logger = loggerModule.child({ subType: 'cohortCommsRepo' });

const partyConditionsSubquery = `
    WHERE (p."state" IN
      ('${DALTypes.PartyStateType.LEASE}',
      '${DALTypes.PartyStateType.FUTURERESIDENT}',
      '${DALTypes.PartyStateType.RESIDENT}',
      '${DALTypes.PartyStateType.MOVINGOUT}')
      OR p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}')
      AND p."workflowState" = '${DALTypes.WorkflowState.ACTIVE}'`;

const withQuery = `
    SELECT party_group_data."partyGroupId", party_group_data."assignedPropertyId", MAX(party_group_data."inventoryId")::uuid as "inventoryId",
      array_agg(party_group_data."partyId") AS "partyIds" from
    (
      SELECT p."partyGroupId",
        p."id" AS "partyId",
        p."assignedPropertyId",
        COALESCE((l."baselineData"->'quote'->> 'inventoryId'), (al."leaseData"->>'inventoryId')) AS "inventoryId"
      FROM db_namespace."Party" p
        LEFT JOIN db_namespace."Lease" l ON p."id" = l."partyId" AND l."status" IN ('${DALTypes.LeaseStatus.SUBMITTED}','${DALTypes.LeaseStatus.EXECUTED}')
        LEFT JOIN db_namespace."ActiveLeaseWorkflowData" al ON al."partyId" = p."id"
      ${partyConditionsSubquery}
        AND ((l.id IS NOT NULL OR al.id IS NOT NULL) OR p."workflowName" = '${DALTypes.WorkflowName.RENEWAL}')
      ORDER BY p."partyGroupId", p.created_at DESC
    ) as party_group_data
    GROUP BY party_group_data."partyGroupId", party_group_data."assignedPropertyId"
  `;

export const savePostRecipientsFromUnitCodes = async (ctx, unitCodes, postId, fileId) => {
  logger.trace({ ctx, unitCodesCount: unitCodes.length, postId, fileId }, 'savePostRecipientsFromUnitCodes');

  const query = `
    INSERT INTO db_namespace."PostRecipient"
      ("id","postId","personId","propertyId","partyGroupId","partyIds",
      "unitExternalId","postRecipientFileId")

    WITH parties_data AS
      (${withQuery})
    SELECT DISTINCT ON ("personId", "postId", "propertyId", "partyGroupId")
      "public".gen_random_uuid() AS "id",
      '${postId}'::uuid AS "postId",
      pm."personId",
      p."assignedPropertyId" AS "propertyId",
      p."partyGroupId",
      p."partyIds",
      us."fullQualifiedName" AS "unitExternalId",
      '${fileId}'::uuid AS "postRecipientFileId"
    FROM db_namespace."PartyMember" pm
      JOIN "parties_data" p on p."partyIds" @> ARRAY[pm."partyId"]
      JOIN db_namespace."UnitSearch" us on us.id = p."inventoryId"
    WHERE p."partyIds" @> ARRAY[pm."partyId"]
      AND pm."endDate" IS null
      AND ARRAY[us."fullQualifiedName"] <@ :unitCodes`;

  const { rows } = await rawStatement(ctx, query, [{ unitCodes }]);

  return rows;
};

export const getNumberOfMatchingResidentsForUnitCodes = async (ctx, unitFullQualifiedNames) => {
  logger.trace({ ctx, unitCodesLength: unitFullQualifiedNames.length }, 'getNumberOfMatchingResidentsForUnitCodes');

  const query = `
    WITH parties_data AS
     (${withQuery})
    SELECT count(distinct (pm."personId")) FROM db_namespace."PartyMember" pm
      JOIN "parties_data" p ON p."partyIds" @> ARRAY[pm."partyId"]
      JOIN db_namespace."UnitSearch" us ON us.id = p."inventoryId"
    WHERE us."fullQualifiedName" IN (${unitFullQualifiedNames.map(name => `'${name}'`)})
      AND pm."endDate" IS null
`;

  const { rows } = await rawStatement(ctx, query, [{ unitFullQualifiedNames }]);

  return rows?.[0]?.count;
};

export const savePostRecipientsFromResidentCodes = async (ctx, residentCodes, postId, fileId) => {
  logger.trace({ ctx, residentCodesCount: residentCodes.length, postId, fileId }, 'savePostRecipientsFromResidentCodes');

  const query = `
  INSERT INTO db_namespace."PostRecipient"
    ("id","postId","personId","propertyId","partyGroupId","partyIds","personExternalId",
    "unitExternalId","postRecipientFileId")

  WITH parties_data AS
    (${withQuery})
  SELECT DISTINCT ON ("personId", "postId", "propertyId", "partyGroupId")
    "public".gen_random_uuid() AS "id",
    '${postId}'::uuid AS "postId",
    pm."personId",
    p."assignedPropertyId" AS "propertyId",
    p."partyGroupId",
    p."partyIds",
    CASE WHEN (epmi."externalId" is not null) THEN epmi."externalId"
         WHEN (epmi."externalRoommateId" is not null) THEN epmi."externalRoommateId" end
         AS "personExternalId",
    us."fullQualifiedName" AS "unitExternalId",
    '${fileId}'::uuid AS "postRecipientFileId"
  FROM db_namespace."ExternalPartyMemberInfo" epmi
    JOIN "parties_data" p ON p."partyIds" @> ARRAY[epmi."partyId"]
    JOIN db_namespace."PartyMember" pm ON pm."id" = epmi."partyMemberId"
    JOIN db_namespace."UnitSearch" us on us.id = p."inventoryId"
  WHERE epmi."endDate" IS null
    AND pm."endDate" IS null
    AND (ARRAY[epmi."externalId"] <@ :residentCodes
    OR ARRAY[epmi."externalRoommateId"] <@ :residentCodes)

  RETURNING *
    `;

  const { rows } = await rawStatement(ctx, query, [{ residentCodes }]);
  return rows;
};

const selectQueryForResidentCodes = `SELECT DISTINCT ON (pm."personId") pm."personId",
      epmi."endDate",
      COALESCE(epmi."externalId", epmi."externalRoommateId") AS "externalId",
      p.id,
      p.state,
      p."assignedPropertyId",
      p."partyGroupId",
      p."workflowState",
      pers."fullName",
      COALESCE((al."leaseData"->>'inventoryId')::uuid, (l."baselineData"->'quote'->> 'inventoryId')::uuid) AS "inventoryId"
    FROM db_namespace."ExternalPartyMemberInfo" epmi
      JOIN db_namespace."Party" p on p."id" = epmi."partyId"
      JOIN db_namespace."PartyMember" pm ON pm."id" = epmi."partyMemberId"
      JOIN db_namespace."Person" pers ON pers.id = pm."personId"
      LEFT JOIN db_namespace."Lease" l ON p."id" = l."partyId" AND l."status" IN ('${DALTypes.LeaseStatus.SUBMITTED}','${DALTypes.LeaseStatus.EXECUTED}')
      LEFT JOIN db_namespace."ActiveLeaseWorkflowData" al ON al."partyId" = p."id"
    WHERE (ARRAY[epmi."externalRoommateId"] <@ :unmatchedCodes OR ARRAY[epmi."externalId"] <@ :unmatchedCodes)
    ORDER BY pm."personId", epmi."endDate" DESC
    `;

export const saveUnmatchedPostRecipientsFromResidentCodes = async (ctx, unmatchedCodes, postId, fileId) => {
  logger.trace({ ctx, residentCodesCount: unmatchedCodes.length, postId, fileId }, 'saveUnmatchedPostRecipientsFromResidentCodes');

  const query = `
    INSERT INTO db_namespace."PostRecipient"
      ("id","postId","personId","propertyId","partyGroupId","partyIds","personExternalId",
      "unitExternalId","postRecipientFileId", "reason", "status")

    WITH parties_data AS
      (${selectQueryForResidentCodes})
    SELECT DISTINCT ON ("personId", "postId", "propertyId", "partyGroupId")
      "public".gen_random_uuid() AS "id",
      '${postId}'::uuid AS "postId",
      pd."personId",
      pd."assignedPropertyId" AS "propertyId",
      pd."partyGroupId",
      ARRAY[(pd.id)] AS "partyIds",
      pd."externalId" "personExternalId",
      us."fullQualifiedName" AS "unitExternalId",
      '${fileId}'::uuid AS "postRecipientFileId",
      CASE WHEN (pd."workflowState" <> '${DALTypes.WorkflowState.ACTIVE}') THEN 'Party closed'
           WHEN (pd."workflowState" = '${DALTypes.WorkflowState.ACTIVE}' AND pd."endDate" IS NOT NULL) THEN 'Member vacated'
           ELSE 'Party state not permitted to use the app: ' || pd.state END
        AS reason,
      '${DALTypes.PostRecipientStatus.NOT_SENT}' AS status
    FROM db_namespace."ExternalPartyMemberInfo" epmi
      JOIN "parties_data" pd ON pd.id = epmi."partyId"
      JOIN db_namespace."PartyMember" pm ON pm."id" = epmi."partyMemberId"
      LEFT JOIN db_namespace."UnitSearch" us ON us.id = pd."inventoryId"
    WHERE (ARRAY[epmi."externalRoommateId"] <@ :unmatchedCodes OR ARRAY[epmi."externalId"] <@ :unmatchedCodes)

    RETURNING *
      `;

  const { rows } = await rawStatement(ctx, query, [{ unmatchedCodes }]);
  return rows;
};

export const saveMissingPostRecipientResidentCodes = async (ctx, postRecipients) => await insertInto(ctx, 'PostRecipient', postRecipients);

export const getNumberOfMatchingResidentCodes = async (ctx, residentCodes) => {
  logger.trace({ ctx, residentCodesCount: residentCodes.length }, 'getNumberOfMatchingResidentCodes');

  const query = `
    SELECT count(distinct (pm."personId")) FROM db_namespace."ExternalPartyMemberInfo" ext
      JOIN db_namespace."Party" p on p."id" = ext."partyId"
      JOIN db_namespace."PartyMember" pm ON pm."id" = ext."partyMemberId"
    ${partyConditionsSubquery}
      AND (ARRAY[ext."externalRoommateId"] <@ :residentCodes OR ARRAY[ext."externalId"] <@ :residentCodes)
      AND ext."endDate" IS null
      AND pm."endDate" IS null
  `;

  const { rows } = await rawStatement(ctx, query, [{ residentCodes }]);

  return rows?.[0]?.count;
};

export const getPostRecipientsByPostId = async (ctx, postId) => {
  const query = `SELECT * FROM db_namespace."PostRecipient"
                 WHERE "postId" = :postId
                 AND status = '${DALTypes.PostRecipientStatus.SENT}'`;
  const { rows } = await rawStatement(ctx, query, [{ postId }]);
  return rows;
};

export const getPostRecipientsBySessionId = async (ctx, sessionId, commsTemplateSettingsId) => {
  const query = `
    SELECT p."fullName",
          pr.id,
          pr."postId",
          pr."propertyId",
          pr."personId",
          cu.email         AS "userEmail",
          cu.id            AS "commonUserId",
          pr."partyIds"[1] AS "partyId"
          ${commsTemplateSettingsId ? ', CASE WHEN nu.id is NULL THEN FALSE else TRUE END "filtered"' : ''}
    FROM db_namespace."PostRecipient" pr
            INNER JOIN db_namespace."Person" p ON pr."personId" = p.id
            LEFT JOIN common."UserPerson" cup
                      ON pr."personId" = cup."personId" and cup."tenantId" = :tenantId
            LEFT JOIN common."Users" cu ON cup."userId" = cu.id
            ${
              commsTemplateSettingsId
                ? 'LEFT JOIN db_namespace."NotificationUnsubscription" nu on nu."personId"=pr."personId" AND nu."commsTemplateSettingsId" = :commsTemplateSettingsId'
                : ''
            }
    WHERE "sessionId" = :sessionId
    AND pr."status" = '${DALTypes.PostRecipientStatus.SENT}'
  `;

  const bindings = { sessionId, tenantId: ctx.tenantId };
  if (commsTemplateSettingsId) bindings.commsTemplateSettingsId = commsTemplateSettingsId;

  const { rows } = await rawStatement(ctx, query, [bindings]);
  return rows;
};

export const getNotificationById = async (ctx, id) => {
  const query = `SELECT * FROM db_namespace."Notification"
                 WHERE "id" = :id`;
  const { rows } = await rawStatement(ctx, query, [{ id }]);
  return rows.length && rows[0];
};

export const saveNotificationUnsubscription = async (ctx, { commsTemplateSettingsId, personId, notificationId = null, directMessageNotificationId = null }) => {
  const query = `
    INSERT INTO db_namespace."NotificationUnsubscription" ("id", "personId", "commsTemplateSettingsId", "notificationId", "directMessageNotificationId")
    VALUES (:id, :personId, :commsTemplateSettingsId, :notificationId, :directMessageNotificationId)
  `;

  await rawStatement(ctx, query, [{ id: v4(), personId, commsTemplateSettingsId, notificationId, directMessageNotificationId }]);
};

export const getNotificationUnsubscriptionByPersonId = async (ctx, personId) => {
  const query = `
    SELECT * FROM db_namespace."NotificationUnsubscription"
    WHERE "personId" = :personId;
  `;

  const { rows = [] } = await rawStatement(ctx, query, [{ personId }]);

  return rows[0];
};

export const replacePersonIdByUnsubscriptionId = async (ctx, notificationUnsubscriptionId, personId) => {
  const query = `
    UPDATE db_namespace."NotificationUnsubscription" SET
    "personId" = :personId
    WHERE id = :notificationUnsubscriptionId
  `;

  await rawStatement(ctx, query, [{ personId, notificationUnsubscriptionId }]);
};

export const getSentPosts = async (ctx, userTeamIds, filters) => {
  logger.trace({ ctx, userTeamIds, filters }, 'getSentPosts');

  const { pageNumber, pageSize, includeMessageDetails } = filters;

  const offSetAndLimitFilter = pageNumber && pageSize ? 'OFFSET :offSet LIMIT :limit' : '';

  const postFieldToSelect = ['id', 'title', 'category', 'message', 'rawMessage', 'sentAt', 'retractedAt', 'metadata', 'publicDocumentId'];
  if (includeMessageDetails) postFieldToSelect.push('messageDetails', 'rawMessageDetails');

  const query = `
  SELECT
    ${postFieldToSelect.map(field => `post."${field}"`).join(',')},
    CASE WHEN documents.metadata->'file'->>'id' IS NOT NULL THEN json_build_object(
      'id', documents.metadata -> 'file' ->> 'id',
      'size', documents.metadata -> 'file' ->> 'size',
      'name', documents.metadata -> 'file' ->> 'originalName'
      )
    END AS "documentMetadata",
    COUNT(*) OVER()
  FROM db_namespace."Post" post
  LEFT JOIN db_namespace."Documents" documents ON (
    documents.context = post.category
    AND (documents.metadata -> 'document' ->> 'postId')::uuid = post.id
  )
  WHERE :userTeamIds && ARRAY(SELECT "teamId" FROM db_namespace."TeamMembers" WHERE "userId" = post."createdBy" )
  AND post."sentAt" IS NOT NULL
  ORDER BY post."sentAt" DESC
  ${offSetAndLimitFilter}
  `;

  const queryParams = { userTeamIds };

  if (pageNumber && pageSize) {
    queryParams.limit = pageSize;
    queryParams.offSet = (pageNumber - 1) * pageSize;
  }

  const { rows } = await rawStatement(ctx, query, [queryParams]);

  return rows;
};

export const getRecipientFilesByPostId = async (ctx, postId) => {
  const query = `
    SELECT * FROM db_namespace."Documents"
    WHERE "metadata"->'document'->>'postId' = :postId;
  `;

  const { rows } = await rawStatement(ctx, query, [{ postId }]);

  return rows;
};

export const deletePost = async (ctx, postId) => {
  const query = `
    DELETE FROM db_namespace."Post"
    WHERE id = :postId
    RETURNING *;
  `;

  const { rows } = await rawStatement(ctx, query, [{ postId }]);
  return rows?.[0];
};

export const deletePostRecipientByPostId = async (ctx, postId) => {
  const query = `
    DELETE FROM db_namespace."PostRecipient"
    WHERE "postId" = :postId
    RETURNING *;
  `;

  const { rows } = await rawStatement(ctx, query, [{ postId }]);
  return rows?.[0];
};

export const deletePostRecipientByFileId = async (ctx, fileId) => {
  const query = `
    DELETE FROM db_namespace."PostRecipient"
    WHERE "postRecipientFileId" = :fileId
    RETURNING *;
  `;

  const { rows } = await rawStatement(ctx, query, [{ fileId }]);
  return rows?.[0];
};

export const getPostsByPersonIdAndPropertyId = async (ctx, personId, propertyId, postColumns = ['*']) => {
  logger.trace({ ctx, personId, propertyId }, 'getPostsByPersonIdAndPropertyId');
  const query = `
    SELECT ${
      postColumns[0] === '*' ? 'post.*' : postColumns.map(column => `post."${column}"`).join(', ')
    }, postRecipient.unread, postRecipient."propertyId", u."fullName" as "createdBy",  pd.uuid,  pd."physicalPublicDocumentId"
    FROM db_namespace."Post" post
    LEFT JOIN db_namespace."Users" u on u.id = post."createdBy"
    INNER JOIN db_namespace."PostRecipient" postRecipient ON postRecipient."postId" = post.id
    LEFT JOIN db_namespace."PublicDocument" pd on pd.uuid = post."publicDocumentId"
    WHERE postRecipient."personId" = :personId
      AND postRecipient."propertyId" = :propertyId
      AND postRecipient."status" = '${DALTypes.PostRecipientStatus.SENT}'
      AND post."sentAt" IS NOT NULL
    ORDER BY post."updated_at" DESC
  `;

  const queryParams = { personId, propertyId };

  const { rows } = await rawStatement(ctx, query, [queryParams]);

  return rows;
};

export const getPostByPersonIdAndPropertyIdAndPostId = async (ctx, personId, propertyId, postId, postColumns = ['*']) => {
  logger.trace({ ctx, personId, propertyId }, 'getPostsByPersonIdAndPropertyIdAndPostId');
  const query = `
    SELECT ${
      postColumns[0] === '*' ? 'post.*' : postColumns.map(column => `post."${column}"`).join(', ')
    }, postRecipient.unread, postRecipient."propertyId", u."fullName" as "createdBy",  pd.uuid,  pd."physicalPublicDocumentId"
    FROM db_namespace."Post" post
    LEFT JOIN db_namespace."Users" u on u.id = post."createdBy"
    INNER JOIN db_namespace."PostRecipient" postRecipient ON postRecipient."postId" = post.id
    LEFT JOIN db_namespace."PublicDocument" pd on pd.uuid = post."publicDocumentId"
    WHERE
      postRecipient."personId" = :personId AND
      postRecipient."propertyId" = :propertyId AND
      postRecipient."status" = '${DALTypes.PostRecipientStatus.SENT}' AND
      post.id = :postId
      AND post."sentAt" IS NOT NULL
    ORDER BY post."updated_at" DESC
  `;

  const queryParams = { personId, propertyId, postId };

  const { rows } = await rawStatement(ctx, query, [queryParams]);

  return rows?.[0] || null;
};

export const getNotificationByRecipientId = async (ctx, postRecipientId) => {
  const query = `
    SELECT n.id AS "notificationId", p."displayName" AS "propertyDisplayName", p.id AS "propertyId",
    CASE WHEN "Person"."mergedWith" IS NULL THEN "Person".id ELSE "Person"."mergedWith" END AS "personId"
    FROM db_namespace."Notification" n
    INNER JOIN db_namespace."PostRecipient" pr ON pr.id = n."postRecipientId"
    INNER JOIN db_namespace."Property" p ON p.id = pr."propertyId"
    INNER JOIN db_namespace."Person" ON "Person".id = pr."personId"
    WHERE n."postRecipientId" = :postRecipientId;
  `;

  const { rows = [] } = await rawStatement(ctx, query, [{ postRecipientId }]);

  return rows[0];
};

export const getNotificationByDirectMessageNotificationId = async (ctx, directMessageNotificationId) => {
  const query = `
    SELECT CASE WHEN "Person"."mergedWith" IS NULL THEN "Person".id ELSE "Person"."mergedWith" END AS "personId",
    dmn.id AS "directMessageNotificationId", p."displayName" AS "propertyDisplayName", p.id AS "propertyId"
    FROM db_namespace."DirectMessageNotification" dmn
    INNER JOIN db_namespace."Property" p ON p.id = dmn."propertyId"
    INNER JOIN db_namespace."Communication" c ON c.id = dmn."communicationId"
    INNER JOIN db_namespace."Person" on "Person".id::varchar = ANY(c.persons)
    WHERE dmn.id = :directMessageNotificationId;
  `;

  const { rows = [] } = await rawStatement(ctx, query, [{ directMessageNotificationId }]);

  return rows[0];
};

export const createPost = async (ctx, post) => {
  const { title, message, messageDetails, rawMessage, rawMessageDetails, category, createdBy, updatedBy, sentAt, sentBy } = post;
  const query = `INSERT INTO db_namespace."Post"
                 ("id", "title", "message", "rawMessage", "messageDetails", "rawMessageDetails", "category", "createdBy", "updatedBy", "sentAt", "sentBy") VALUES
                 (:id, :title, :message, :rawMessage, :messageDetails, :rawMessageDetails, :category, :createdBy, :updatedBy, :sentAt, :sentBy)
                 RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [
    {
      id: v4(),
      title: title || null,
      message: message || null,
      messageDetails: messageDetails || null,
      rawMessage: rawMessage || null,
      rawMessageDetails: rawMessageDetails || null,
      category,
      createdBy,
      updatedBy,
      sentAt: sentAt || null,
      sentBy: sentBy || null,
    },
  ]);

  return rows.length && rows[0];
};

export const getPostById = async (ctx, id, columns = ['*']) => {
  const query = `SELECT ${
    columns[0] === '*' ? 'p.*' : columns.map(column => `p."${column}"`).join(', ')
  }, u1."fullName" as "createdBy", u2."fullName" as "updatedBy", u2."fullName" as "sentByAgent"
  FROM db_namespace."Post" p
  INNER JOIN db_namespace."Users" u1 on u1.id = p."createdBy"
  INNER JOIN db_namespace."Users" u2 on u2.id = p."updatedBy"
  LEFT JOIN db_namespace."Users" u3 on u2.id = p."sentBy"
  WHERE P.id = :postId`;

  const { rows } = await rawStatement(ctx, query, [{ postId: id }]);

  return rows.length && rows[0];
};

export const updatePostById = async (ctx, id, post) => {
  const { title, message, messageDetails, rawMessage, rawMessageDetails, updatedBy, sentAt, sentBy } = post;

  const query = `UPDATE db_namespace."Post" SET
    ${!nullish(title) ? '"title" = :title,' : ''}
    ${!nullish(message) ? '"message" = :message,' : ''}
    ${!nullish(messageDetails) ? '"messageDetails" = :messageDetails,' : ''}
    ${!nullish(rawMessage) ? '"rawMessage" = :rawMessage,' : ''}
    ${!nullish(rawMessageDetails) ? '"rawMessageDetails" = :rawMessageDetails,' : ''}
    ${sentAt ? '"sentAt" = :sentAt,' : ''}
    ${sentBy ? '"sentBy" = :sentBy,' : ''}
    "updatedBy" = :updatedBy
    WHERE id = :postId
    RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [
    {
      postId: id,
      title,
      message,
      messageDetails,
      rawMessage,
      rawMessageDetails,
      updatedBy,
      sentAt,
      sentBy,
    },
  ]);

  return rows?.[0];
};

export const getDraftPosts = async ctx => {
  logger.trace({ ctx }, 'getDraftPosts');

  const query = `
    SELECT post.id, post.category, post.title, post."created_at", users."fullName" AS "createdBy",
    json_build_object('id', pd.uuid,
    'size', pd.metadata -> 'file' ->> 'size',
    'name', pd.metadata -> 'file' ->> 'originalName') as "heroImageMetada",
    case when documents.metadata->'file'->>'id' is not null then json_build_object(
      'id', documents.metadata -> 'file' ->> 'id',
      'size', documents.metadata -> 'file' ->> 'size',
      'name', documents.metadata -> 'file' ->> 'originalName'
      )
    end as "documentMetadata"
    FROM db_namespace."Post" post
    INNER JOIN db_namespace."Users" users ON (users.id = post."createdBy")
    LEFT JOIN db_namespace."PublicDocument" pd on pd.uuid = post."publicDocumentId"
    LEFT JOIN db_namespace."Documents" documents ON (
      documents.context = post.category
      AND (documents.metadata -> 'document' ->> 'postId')::uuid = post.id
    )
    WHERE post."sentAt" IS NULL
    ORDER BY post.updated_at DESC
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getAllPosts = async ctx => {
  const query = `
    SELECT * FROM db_namespace."Post"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const updatePostsAsRead = async (ctx, personId, postIds, propertyId) => {
  const query = `UPDATE db_namespace."PostRecipient" SET
    "unread" = FALSE
    WHERE "personId" = :personId
    AND "postId" in (${postIds.map(id => `'${id}'`)})
    AND "propertyId" = :propertyId
    RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ personId, propertyId }]);

  return rows?.map(row => row.postId) || [];
};

export const updateDirectMessagesAsRead = async (ctx, personId, messageIds) => {
  const query = `UPDATE db_namespace."Communication" SET
    "unread" = FALSE
    WHERE :personId = any(persons)
    AND "id" in (${messageIds.map(id => `'${id}'`)})
    RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ personId }]);

  return rows?.map(row => row.id) || [];
};

export const updatePostAsClicked = async (ctx, personId, postId, propertyId) => {
  const query = `
    UPDATE db_namespace."PostRecipient" SET "postClicked" = TRUE
      WHERE "personId" = :personId
      AND "postId" = :postId
      AND "propertyId" = :propertyId
      AND "postClicked" = FALSE
    RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ personId, postId, propertyId }]);

  return rows?.map(row => row.postId) || [];
};

export const updatePostLinkAsVisited = async (ctx, personId, postId, link, propertyId) => {
  const query = `
    UPDATE db_namespace."PostRecipient" SET "visitedLinksInPost" = array_append("visitedLinksInPost", :link)
      WHERE "personId" = :personId
      AND "postId" = :postId
      AND "propertyId" = :propertyId
      AND NOT "visitedLinksInPost" @> ARRAY[:link]
    RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [{ personId, postId, propertyId, link }]);

  return rows?.map(row => row.postId) || [];
};

export const getPostStatistics = async (ctx, postIds, showExtendedStatistics = false) => {
  const selectExtendedStatistics = showExtendedStatistics
    ? `,
    no_of_users_who_visited_links AS
    (
      SELECT p.id, COUNT(*) AS "noOfUsersWhoVisitedLinks"
      FROM posts_to_return AS p
        LEFT JOIN db_namespace."PostRecipient" pr ON p.id = pr."postId"
      WHERE pr.status = :sentRecipientStatus AND "visitedLinksInPost" <> '{}'
      GROUP BY p.id
    ),
    total_recipients_in_initial_file AS
    (
      SELECT p.id, metadata->'document'->'matchingResidentInfo'->>'totalNumberOfCodes' as "totalRecipientsInInitialFile"
      FROM posts_to_return AS p
        LEFT JOIN db_namespace."Documents" doc on p.id::text = "metadata"->'document'->>'postId'
    )`
    : '';

  const extendedStatistics = showExtendedStatistics
    ? `,
    coalesce(r4."totalRecipientsInInitialFile"::integer, 0) AS "totalRecipientsInInitialFile",
    coalesce(r5."noOfUsersWhoVisitedLinks", 0) AS "noOfUsersWhoVisitedLinks"`
    : '';

  const joinStatistics = showExtendedStatistics
    ? `
    LEFT JOIN total_recipients_in_initial_file AS r4 ON pr.id = r4.id
    LEFT JOIN no_of_users_who_visited_links AS r5 ON pr.id = r5.id`
    : '';

  const selectPosts = `
    WITH posts_to_return AS
    (
      SELECT p.id, p."sentAt", p."sentBy"
      FROM db_namespace."Post" p
      WHERE ARRAY[p.id::text] <@ :postIds
    ),
  `;

  const selectRecipientsWhoReceived = `
    recipients_who_received AS
    (
      SELECT p.id, COUNT(DISTINCT "personId") AS "recipientsWhoReceived"
      FROM posts_to_return AS p
        LEFT JOIN db_namespace."PostRecipient" pr ON p.id = pr."postId"
      WHERE p."sentAt" IS NOT NULL AND p."sentBy" IS NOT NULL AND pr.status = :sentRecipientStatus
      GROUP BY p.id
    ),
  `;

  const selectRecipientsWhoViewed = `
    recipients_who_viewed AS
    (
      SELECT p.id, COUNT(*) AS "recipientsWhoViewed"
      FROM posts_to_return AS p
        LEFT JOIN db_namespace."PostRecipient" pr ON p.id = pr."postId"
      WHERE p."sentAt" IS NOT NULL AND p."sentBy" IS NOT NULL AND pr.status = :sentRecipientStatus AND pr.unread = false
      GROUP BY p.id
    ),
  `;

  const selectRecipientsWhoClicked = `
    recipients_who_clicked AS
    (
      SELECT p.id, COUNT(*) AS "recipientsWhoClicked"
      FROM posts_to_return AS p
        LEFT JOIN db_namespace."PostRecipient" pr ON p.id = pr."postId"
      WHERE p."sentAt" IS NOT NULL AND p."sentBy" IS NOT NULL AND pr.status = :sentRecipientStatus AND pr."postClicked" = 'TRUE'
      GROUP BY p.id
    )
  `;

  const query = `
    ${selectPosts}
    ${selectRecipientsWhoReceived}
    ${selectRecipientsWhoViewed}
    ${selectRecipientsWhoClicked}
    ${selectExtendedStatistics}
    SELECT pr.id as "postId",
      coalesce(r1."recipientsWhoReceived", 0) AS "recipientsWhoReceived",
      coalesce(r2."recipientsWhoViewed", 0) AS "recipientsWhoViewed",
      coalesce(r3."recipientsWhoClicked", 0) AS "recipientsWhoClicked"
      ${extendedStatistics}
    FROM posts_to_return AS pr
      LEFT JOIN recipients_who_received AS r1 ON pr.id = r1.id
      LEFT JOIN recipients_who_viewed AS r2 ON pr.id = r2.id
      LEFT JOIN recipients_who_clicked AS r3 ON pr.id = r3.id
      ${joinStatistics}
  `;

  const { rows } = await rawStatement(ctx, query, [{ postIds, sentRecipientStatus: DALTypes.PostRecipientStatus.SENT }]);

  return showExtendedStatistics ? rows[0] : rows;
};

export const updatePostAsRetracted = async (ctx, postId, retractDetails) => {
  const query = `
    UPDATE db_namespace."Post"
    SET metadata = jsonb_set(metadata, '{retractDetails}', :retractDetails), "retractedAt" = now()
    WHERE "id" = :postId;
    `;

  await rawStatement(ctx, query, [{ postId, retractDetails }]);
};

export const markRetractedPostAsRead = async (ctx, postId) => {
  const query = `
    UPDATE db_namespace."PostRecipient"
    SET unread = FALSE
    WHERE "postId" = :postId
      AND status = :sentRecipientStatus;
    `;

  await rawStatement(ctx, query, [{ postId, sentRecipientStatus: DALTypes.PostRecipientStatus.SENT }]);
};

export const updateNotificationStatus = async (ctx, recipientIds, status, reason = null) => {
  const query = `UPDATE db_namespace."Notification"
                   SET status = :status, "resolution" = :reason
                 WHERE "postRecipientId" = ANY( :recipientIds)`;

  await rawStatement(ctx, query, [
    {
      recipientIds,
      status,
      reason,
    },
  ]);
};

export const updateRecipientsWithSessionId = async (ctx, sessionId, postRecipientIds) => {
  const query = `UPDATE db_namespace."PostRecipient"
                   SET "sessionId" = :sessionId
                 WHERE id = ANY( :recipientIds)`;

  await rawStatement(ctx, query, [
    {
      sessionId,
      recipientIds: postRecipientIds,
    },
  ]);
};

export const bulkInsertNotifications = async (ctx, notifications) => await insertInto(ctx, 'Notification', notifications);

export const saveNotificationTemplate = async (ctx, sessionId) => {
  logger.trace({ ctx }, 'saveNotificationTemplate');

  const query = `
    INSERT INTO db_namespace."NotificationTemplate"
      ("id","postRecipientSessionId")
    VALUES
      (public.gen_random_uuid(), :sessionId)
      RETURNING id;`;

  const { rows } = await rawStatement(ctx, query, [{ sessionId }]);

  return rows.length && rows[0].id;
};

export const updateNotificationTemplate = async (ctx, sessionId, renderedTemplateSubject, renderedTemplateBody) => {
  logger.trace({ ctx, sessionId }, 'updateNotificationTemplate');

  const query = `UPDATE db_namespace."NotificationTemplate"
                   SET "templateSubject" = :renderedTemplateSubject, "templateBody" = :renderedTemplateBody
                 WHERE "postRecipientSessionId" = :sessionId`;

  await rawStatement(ctx, query, [
    {
      sessionId,
      renderedTemplateSubject,
      renderedTemplateBody,
    },
  ]);
};

export const getNumberOfRecipientsByPostId = async (ctx, postId) => {
  const query = `
    SELECT COUNT(*) FROM db_namespace."PostRecipient"
    WHERE "postId" = :postId
    AND status = '${DALTypes.PostRecipientStatus.SENT}'
  `;

  const { rows = [] } = await rawStatement(ctx, query, [{ postId }]);
  return (rows.length && rows[0].count) || 0;
};

export const bulkUpdateNotifications = async (ctx, event) => {
  logger.trace({ ctx, eventLength: event.length }, 'bulkUpdateNotifications');

  const query = event
    .map(message =>
      message.reason
        ? `UPDATE db_namespace."Notification" SET status = '${message.event}', "resolution" = '${message.reason}'
           WHERE "postRecipientId" = '${message.recipientId}'`
        : `UPDATE db_namespace."Notification" SET status = '${message.event}'
           WHERE "postRecipientId" = '${message.recipientId}'`,
    )
    .join('; ');

  return await rawStatement(ctx, query);
};

export const saveDirectMessageNotification = async (ctx, notification) => {
  logger.trace({ ctx, notification }, 'saveDirectMessageNotification');
  const { id, communicationId, message, status, propertyId } = notification;

  const query = `
    INSERT INTO db_namespace."DirectMessageNotification" ("id", "communicationId", "message", "status", "propertyId")
    VALUES (:id, :communicationId, :message, :status, :propertyId)
    RETURNING id`;

  const { rows } = await rawStatement(ctx, query, [
    {
      id,
      communicationId,
      message,
      status,
      propertyId,
    },
  ]);

  return rows[0];
};

export const updateDirectMessageNotificationStatus = async (ctx, notificationId, status, reason = null) => {
  const query = `UPDATE db_namespace."DirectMessageNotification"
                   SET status = :status, "errorReason" = :reason
                 WHERE "id" = :notificationId`;

  await rawStatement(ctx, query, [
    {
      notificationId,
      status,
      reason,
    },
  ]);
};

const sanitizeParamsObject = parameter => {
  const result = {};

  for (const [key, value] of Object.entries(parameter)) {
    if (typeOf(value) === 'string') {
      const sanitizedValue = value.replace("'", "''");
      result[key] = sanitizedValue;
    } else if (value) {
      result[key] = value;
    }
  }

  return result;
};

export const bulkUpdateNotificationParams = async (ctx, notificationParams) => {
  logger.trace({ ctx, notificationParams }, 'bulkUpdateNotificationParams');

  const query = notificationParams
    .map(param => {
      const sanitizedParamsObject = param.substitutions ? sanitizeParamsObject(param.substitutions) : {};
      const substitutions = JSON.stringify(sanitizedParamsObject);

      return `UPDATE db_namespace."Notification"
        SET "messageParams" = jsonb_set("messageParams", '{substitutions}', '${substitutions}'::jsonb, true)
      WHERE "postRecipientId" = '${param.recipientId}'`;
    })
    .join('; ');

  return await rawStatement(ctx, query);
};
export const updatePostHeroImageIdByPostId = async (ctx, id, heroImageId) => {
  const query = `UPDATE db_namespace."Post" SET
    "publicDocumentId" = :heroImageId
    WHERE id = :postId
    RETURNING *`;

  const { rows } = await rawStatement(ctx, query, [
    {
      postId: id,
      heroImageId,
    },
  ]);

  return rows?.[0];
};

export const deletePostsPublicDocumentReference = async (req, publicDocumentId) => {
  const query = `UPDATE db_namespace."Post"
  SET "publicDocumentId" = NULL
  WHERE "publicDocumentId" =:publicDocumentId`;

  const { rows } = await rawStatement(req, query, [
    {
      publicDocumentId,
    },
  ]);

  return rows?.[0];
};

export const getPostRecipientToDownload = async (ctx, postId) => {
  logger.trace({ ctx, postId }, 'getPostRecipientToDownload');

  const query = `
    SELECT
      pr."personExternalId" AS "TCode",
      CASE WHEN (pr.status = 'sent') THEN 'Yes'
        ELSE 'No - ' || pr.reason END
      AS "Message delivered",
      pers."fullName" AS "Name in Reva",
      pr."unitExternalId" AS "Associated unit",
      p.state AS "Party state in Reva",
      p.id AS "partyId"
    FROM db_namespace."PostRecipient" pr
    LEFT JOIN db_namespace."Party" p ON p.id = pr."partyIds"[1]::uuid
    LEFT JOIN db_namespace."Person" pers ON pr."personId" = pers.id
      WHERE pr."postId" = :postId
  `;

  const { rows } = await rawStatement(ctx, query, [{ postId }]);
  return rows;
};
