/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getMarketingSearches } from '../../../dal/marketingSearchRepo';
import { buildDataPumpFormat } from '../../helpers/export';

export const exportMarketingSearch = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const marketingSearch = await getMarketingSearches(ctx);

  return buildDataPumpFormat(marketingSearch, columnHeadersOrdered);
};
