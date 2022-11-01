/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise, mapSeries } from 'bluebird';

import * as mergeRepo from '../../dal/mergePartyRepo';
import { getInventoriesOnHoldByParty, updateInventoryOnHold } from '../../dal/inventoryRepo';
import { saveUnitReleasedEvent, saveUnitHeldEvent } from '../partyEvent';
import loggerModule from '../../../common/helpers/logger';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../pubsub';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

export const mergeQuotes = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergeQuotes - params');
  const start = new Date().getTime();

  const mergedPartyQuotes = await mergeRepo.getQuotes(ctx, mergedPartyId);

  const result = await Promise.reduce(
    mergedPartyQuotes || [],
    async (updatedQuotes, quote) => {
      const updatedQuote = await mergeRepo.updateQuote(ctx, {
        id: quote.id,
        partyId: basePartyId,
      });
      return [...updatedQuotes, updatedQuote];
    },
    [],
  );

  result.length &&
    (await sendMessage({
      ctx,
      exchange: APP_EXCHANGE,
      key: SCREENING_MESSAGE_TYPE.APPLICANT_DATA_UPDATED,
      message: {
        tenantId: ctx.tenantId,
        partyId: basePartyId,
      },
    }));

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergeQuotes - duration');
  return result;
};

export const mergeInventoriesOnHold = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergeQuotes - params');

  const mergedPartyInventoriesOnHold = await getInventoriesOnHoldByParty(ctx, mergedPartyId);
  const basedPartyActiveInventoriesOnHold = (await getInventoriesOnHoldByParty(ctx, basePartyId)).filter(inv => !inv.endDate);
  const mergedPartyActiveInventoriesOnHold = mergedPartyInventoriesOnHold.filter(inv => !inv.endDate);

  await mapSeries(mergedPartyInventoriesOnHold, async inventoryOnHold => {
    await updateInventoryOnHold(ctx, inventoryOnHold.id, { partyId: basePartyId });
  });

  if (mergedPartyActiveInventoriesOnHold.length) {
    const selectedInventoryAfterMerge = !basedPartyActiveInventoriesOnHold.length
      ? mergedPartyActiveInventoriesOnHold[0]
      : basedPartyActiveInventoriesOnHold[0];

    await saveUnitReleasedEvent(ctx, {
      partyId: mergedPartyId,
    });
    await saveUnitHeldEvent(ctx, {
      partyId: basePartyId,
      metadata: {
        inventoryOnHoldId: selectedInventoryAfterMerge.id,
        inventoryId: selectedInventoryAfterMerge.inventoryId,
      },
    });
  }

  return [];
};
