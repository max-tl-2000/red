/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { runInTransaction, initQuery, insertOrUpdate, rawStatement } from '../database/factory';
import { formatCampaignForSave } from '../helpers/importUtils';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'campaignsRepo' });

export const getCampaignByName = async (ctx, campaignName) => {
  const query = `SELECT c.*
  FROM db_namespace."Campaigns" c
  WHERE LOWER(c."name") = '${campaignName.toLowerCase()}'
  `;
  const { rows } = await rawStatement(ctx, query);
  return rows[0];
};

export const getCampaigns = async ctx => await initQuery(ctx).from('Campaigns');

export const saveCampaign = async (ctx, data) => {
  logger.trace({ ctx, data }, 'saveCampaign');

  const campaign = formatCampaignForSave(data);

  return runInTransaction(async innerTrx => {
    const innerCtx = { trx: innerTrx, ...ctx };
    const { id } = (await getCampaignByName(innerCtx, campaign.name)) || {};

    return await insertOrUpdate(
      innerCtx,
      'Campaigns',
      { id, ...campaign },
      {
        conflictColumns: ['name'],
      },
    );
  }, ctx);
};
export const getCampaignsToExport = async (ctx, simpleFields) => {
  const simpleFieldsToSelect = simpleFields.map(field => `"${field}"`);

  const query = `
    SELECT ${simpleFieldsToSelect}
    FROM db_namespace."Campaigns"
  `;

  const { rows } = await rawStatement(ctx, query);
  return rows;
};
