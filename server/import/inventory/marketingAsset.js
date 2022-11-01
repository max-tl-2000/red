/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveMarketingAsset } from '../../dal/marketingAssetsRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { DALTypes } from '../../../common/enums/DALTypes';

const REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'type',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.MarketingAssetType,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'url',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayDescription',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'altTag',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
];

const saveMarketingAssetData = async (ctx, marketingAsset) =>
  await saveMarketingAsset(ctx, {
    name: marketingAsset.name,
    type: marketingAsset.type,
    url: marketingAsset.url,
    displayName: marketingAsset.displayName,
    displayDescription: marketingAsset.displayDescription,
    altTag: marketingAsset.altTag,
  });

export const importMarketingAssets = async (ctx, marketingAssets) => {
  const invalidFields = await validate(
    marketingAssets,
    {
      requiredFields: REQUIRED_FIELDS,
      async onValidEntity(marketingAsset) {
        await saveMarketingAssetData(ctx, marketingAsset);
      },
    },
    ctx,
    spreadsheet.MarketingAssets.columns,
  );

  return {
    invalidFields,
  };
};
