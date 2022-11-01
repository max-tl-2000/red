/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { rawStatement, insertOrUpdate } from '../database/factory';

export const saveMarketingQuestion = async (ctx, data) => await insertOrUpdate(ctx.tenantId, 'MarketingQuestions', data);

export const getMarketingQuestionByName = async (ctx, name) => {
  const query = `
        SELECT * FROM db_namespace."MarketingQuestions" mq
          WHERE mq.name = :name `;

  const { rows } = await rawStatement(ctx, query, [{ name }]);
  return rows[0];
};

export const getMarketingQuestions = async ctx => {
  const query = `
    SELECT *
    FROM db_namespace."MarketingQuestions"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getMarketingQuestionsToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `"${field}"`);

  const query = `
    SELECT ${simpleFieldsToSelect}
    FROM db_namespace."MarketingQuestions"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};

export const getMarketingQuestionsByInventoryId = async (ctx, inventoryId) => {
  const query = `
    SELECT mq."id", mq."name", mq."displaySectionQuestion", mq."displayPrimaryQuestion",
          mq."displayPrimaryQuestionDescription", mq."displayFollowupQuestion", mq."inputTypeForFollowupQuestion", mq."displayOrder"
    FROM db_namespace."Inventory" inv
      INNER JOIN db_namespace."InventoryGroup" invG
        ON inv."inventoryGroupId" = invG."id"
      INNER JOIN db_namespace."Associated_Fee" assocFee
        ON invG."feeId" = assocFee."primaryFee"
        AND NOT assocFee."isAdditional"
      INNER JOIN db_namespace."Fee" f
        ON assocFee."associatedFee" = f."id"
      INNER JOIN db_namespace."MarketingQuestions" mq
        ON mq."id" = f."marketingQuestionId"
        AND NOT mq."inactive"
     WHERE inv."id" = :inventoryId
  `;

  const { rows } = await rawStatement(ctx, query, [{ inventoryId }]);
  return rows;
};
