/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getAmenities, getAmenitiesProperty } from '../../services/amenities';
import { getAmenitiesByCategory } from '../../dal/amenityRepo';
import config from '../../config';

export const getFilteredAmenities = async req => {
  const readOnlyServer = config.useReadOnlyServer;
  const ctx = { ...req, readOnlyServer };

  if (req.query.propertyId) {
    return await getAmenitiesProperty(ctx, req.query.propertyId);
  }
  if (req.query.category && req.query.subCategory) {
    return await getAmenitiesByCategory(ctx, req.query.category, req.query.subCategory);
  }
  return await getAmenities(ctx);
};
