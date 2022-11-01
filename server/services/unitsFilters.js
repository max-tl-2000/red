/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ServiceError } from '../common/errors';
import { updateOne } from '../database/factory';
import logger from '../../common/helpers/logger';

/**
 * Get all the filters
 *
 * TODO amenities should be filtered by party
 * why? a sales person can have access to n properties
 * for now, we'll retrieve all the amenities in the database and merge them
 * also, numBathrooms, numBedrooms, etc should be rtrieved from db by sales person
 */

export const putUnitsFilters = async (ctx, partyId, filters) => {
  try {
    await updateOne(ctx.tenantId, 'Party', partyId, {
      storedUnitsFilters: filters,
    });
  } catch (error) {
    logger.error({ error, partyId, filters }, 'Error saving unit filters');
    throw new ServiceError('ERROR_SAVING_UNITS_FILTERS');
  }
};
