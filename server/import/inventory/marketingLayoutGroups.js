/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveMarketingLayoutGroup } from '../../dal/marketingLayoutGroupsRepo.js';
import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'order',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'shortDisplayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
];

const saveMarketingLayoutGroupData = async (ctx, marketingLayoutGroup) =>
  await saveMarketingLayoutGroup(ctx, {
    name: marketingLayoutGroup.name,
    order: marketingLayoutGroup.order || 0,
    displayName: marketingLayoutGroup.displayName,
    shortDisplayName: marketingLayoutGroup.shortDisplayName,
    description: marketingLayoutGroup.description,
  });

export const importMarketingLayoutGroups = async (ctx, marketingLayoutGroups) => {
  const invalidFields = await validate(
    marketingLayoutGroups,
    {
      requiredFields: REQUIRED_FIELDS,
      async onValidEntity(marketingLayoutGroup) {
        await saveMarketingLayoutGroupData(ctx, marketingLayoutGroup);
      },
    },
    ctx,
    spreadsheet.MarketingLayoutGroups.columns,
  );

  return {
    invalidFields,
  };
};
