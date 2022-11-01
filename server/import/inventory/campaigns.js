/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveCampaign } from '../../dal/campaignsRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const sourceRequiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
];

export const importCampaigns = async (ctx, rows) => {
  const invalidFields = await validate(
    rows,
    {
      requiredFields: sourceRequiredFields,
      async onValidEntity(campaign) {
        return await saveCampaign(ctx, campaign);
      },
    },
    ctx,
    spreadsheet.Campaign.columns,
  );

  return {
    invalidFields,
  };
};
