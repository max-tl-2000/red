/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';

export const PartyScoreSchema = {
  type: 'object',
  properties: {
    partyId: {
      type: 'string',
      required: true,
    },
    score: {
      type: 'string',
      required: true,
      enum: Object.values(DALTypes.LeadScore),
    },
  },
};
