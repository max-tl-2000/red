/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';
import { getApplicationDataByIdQuery } from '../../../rentapp/server/dal/person-application-repo';
import { formatPersonLegalName } from './helpers/person';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { personApplicationId }) => getApplicationDataByIdQuery(ctx, personApplicationId).toString();

export const tokensMapping = {
  legalName: ({ applicationData = {} }) => formatPersonLegalName(applicationData),
};
