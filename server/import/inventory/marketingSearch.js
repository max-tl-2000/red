/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation } from './util.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { saveMarketingSearchData } from '../../dal/marketingSearchRepo';

const MARKETING_SEARCH_REQUIRED_FIELDS = [
  {
    fieldName: 'order',
    validation: [Validation.NOT_EMPTY, Validation.NUMERIC],
  },
  {
    fieldName: 'entryMatch',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'scope',
    validation: [Validation.NOT_EMPTY],
  },
];

const createMarketingSearchRecord = marketingSearch => ({
  order: marketingSearch.order,
  entryMatch: marketingSearch.entryMatch,
  scope: marketingSearch.scope,
  stateScope: marketingSearch.stateScope,
  cityScope: marketingSearch.cityScope,
  url: marketingSearch.url,
  queryStringFlag: marketingSearch.queryStringFlag,
  inactiveFlag: marketingSearch.inactiveFlag,
});

export const importMarketingSearch = async (ctx, marketingSearch) => {
  const marketingSearchRecordsToSave = [];

  const validations = await validate(
    marketingSearch,
    {
      requiredFields: MARKETING_SEARCH_REQUIRED_FIELDS,
      async onValidEntity(marketingSearchData) {
        marketingSearchRecordsToSave.push(createMarketingSearchRecord(marketingSearchData));
      },
    },
    ctx,
    spreadsheet.MarketingSearch.columns,
  );

  marketingSearchRecordsToSave.length && (await saveMarketingSearchData(ctx, marketingSearchRecordsToSave));

  return {
    invalidFields: [...validations],
  };
};
