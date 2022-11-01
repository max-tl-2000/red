/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { putUnitsFilters } from '../../services/unitsFilters';
import * as validators from '../helpers/validators';

export async function saveUnitsFilters(req) {
  await validators.party(req, req.params.partyId);
  const filters = req.body;
  return await putUnitsFilters(req, req.params.partyId, filters);
}
