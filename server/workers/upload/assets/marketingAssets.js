/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveAsset } from './assetsS3Upload';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { validateMarketingAsset, parseMetadataInRxpFilePath } from '../../../helpers/assets-helper';
import config from '../../../config';

export const MARKETING_ASSETS = 'Assets';
const RXP = 'rxp';

const processRxpImage = async (ctx, { filePath, category, rootDirectory }) => {
  const metadata = parseMetadataInRxpFilePath(ctx, filePath);
  const entity = {
    type: DALTypes.AssetType.GLOBAL_ASSET,
    app: RXP,
    category,
    ...metadata,
  };

  await saveAsset(ctx, filePath, entity, rootDirectory);
};

export const processMarketingAsset = async (ctx, { filePath, folders = [], propertyName, rootDirectory }) => {
  if (folders.length && folders[0] === RXP) {
    return await processRxpImage(ctx, { filePath, category: folders[1], rootDirectory });
  }

  const { success, errors } = validateMarketingAsset(filePath, { fileSize: config.import.assetMaxFileSize });
  if (!success) return { errors };

  const entity = {
    type: propertyName ? DALTypes.AssetType.PROPERTY_ASSET : DALTypes.AssetType.GLOBAL_ASSET,
    propertyName,
  };
  return await saveAsset(ctx, filePath, entity, rootDirectory);
};
