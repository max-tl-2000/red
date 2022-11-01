/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import RMSProvider from './rmsProvider';
import { parseDataSetUsingPropertyId, parseDataSetUsingInventoryIds, getPricing } from '../../../import/rms/parsers/reva';
import logger from '../../../../common/helpers/logger';

export default class RevaRmsTestProvider extends RMSProvider {
  getRMSPrices = async (ctx, { propertyId, inventoryIds, pricing }) => {
    const isRevaPricingAsRms = true;
    if (!inventoryIds) {
      logger.info({ ctx, propertyId }, 'Property that will be updating prices');
      return await parseDataSetUsingPropertyId(ctx, propertyId, isRevaPricingAsRms, pricing);
    }
    if (!propertyId) {
      logger.error({ ctx }, 'RevaRmsTestProvider - Property id should be defined');
      return { units: [] };
    }
    return await parseDataSetUsingInventoryIds(ctx, propertyId, inventoryIds, isRevaPricingAsRms);
  };

  saveRMSPrices = async (ctx, { unitsPrices, propertyId, rmsPricingEvent }) => await this.saveUnitsPrices(ctx, { unitsPrices, propertyId, rmsPricingEvent });

  getPricing = async ctx => await getPricing(ctx);
}
