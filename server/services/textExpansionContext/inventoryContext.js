/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getInventoryByIdQuery } from '../../dal/inventoryRepo';
import { VIEW_MODEL_TYPES } from './enums';
import { getBigLayoutImage, getImageForEmail } from '../../../common/helpers/cloudinary';
import { formatInventoryAssetUrl } from '../../helpers/assets-helper';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { inventoryId }) => getInventoryByIdQuery(ctx, inventoryId).toString();

export const tokensMapping = {
  displayName: 'name',
  'type.displayName': 'type',
  heroImageUrl: async ({ id: inventoryId }, { ctx, tokenParams }) => {
    const inventoryAssetUrl = await formatInventoryAssetUrl(ctx, inventoryId, { permaLink: true, from: 'template' });
    return tokenParams.length ? getImageForEmail(inventoryAssetUrl, tokenParams) : getBigLayoutImage(inventoryAssetUrl);
  },
};
