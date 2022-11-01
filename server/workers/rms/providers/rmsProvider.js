/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveUnitsPricingUsingPropertyExternalId, saveUnitsPricingUsingPropertyId } from '../../../dal/rmsPricingRepo';
import { RmsImportError } from '../../../../common/enums/enums';

export default class RMSProvider {
  saveUnitsPrices = async (ctx, { unitsPrices, propertyExternalId, propertyId, rmsPricingEvent }) => {
    let errors = [];
    try {
      const baseParams = { unitsPricing: unitsPrices, rmsPricingEvent };
      errors = await (propertyExternalId
        ? saveUnitsPricingUsingPropertyExternalId(ctx, { ...baseParams, propertyExternalId })
        : saveUnitsPricingUsingPropertyId(ctx, { ...baseParams, propertyId }));
    } catch (error) {
      throw { messages: [error], rmsErrorType: RmsImportError.DATABASE_SAVE_FAILED_ERROR, jobErrorMessage: (error.message || error) }; // eslint-disable-line
    }
    return errors;
  };
}
