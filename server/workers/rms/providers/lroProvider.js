/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import RMSProvider from './rmsProvider';
import { parseFile } from '../../../import/rms/parsers/lro';

export default class LROProvider extends RMSProvider {
  constructor() {
    super();
    this.supportedFileName = 'LRO';
    this.supportedFilePath = '/rms/lro';
  }

  supportsFile = (fileName, originalPath) => fileName.includes(this.supportedFileName) || originalPath.includes(this.supportedFilePath);

  getRMSPrices = async (ctx, file) => await parseFile(ctx, file);

  saveRMSPrices = async (ctx, { unitsPrices, propertyExternalId, rmsPricingEvent }) =>
    await this.saveUnitsPrices(ctx, { unitsPrices, propertyExternalId, rmsPricingEvent });
}
