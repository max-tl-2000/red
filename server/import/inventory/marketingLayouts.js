/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveMarketingLayout } from '../../dal/marketingLayoutsRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { translateFlagCellValue } from '../../helpers/importUtils';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'order',
    validation: [Validation.INTEGER],
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'marketingLayoutGroup',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
  },
];

const PREREQUISITES = [
  {
    field: 'property',
    tableFieldName: 'name',
    table: 'Property',
    idReceiver: 'propertyId',
  },
  {
    field: 'marketingLayoutGroup',
    tableFieldName: 'name',
    table: 'MarketingLayoutGroup',
    idReceiver: 'marketingLayoutGroupId',
  },
];

const saveMarketingLayoutData = async (ctx, marketingLayout) =>
  await saveMarketingLayout(ctx, {
    name: marketingLayout.name,
    propertyId: marketingLayout.propertyId,
    marketingLayoutGroupId: marketingLayout.marketingLayoutGroupId,
    displayName: marketingLayout.displayName,
    description: marketingLayout.description,
    inactive: translateFlagCellValue(marketingLayout.inactiveFlag),
    order: marketingLayout.order || 0,
  });

export const importMarketingLayouts = async (ctx, marketingLayouts) => {
  const invalidFields = await validate(
    marketingLayouts,
    {
      requiredFields: REQUIRED_FIELDS,
      prerequisites: PREREQUISITES,
      onValidEntity(marketingLayout) {
        return saveMarketingLayoutData(ctx, marketingLayout);
      },
    },
    ctx,
    spreadsheet.MarketingLayouts.columns,
  );

  return {
    invalidFields,
  };
};
