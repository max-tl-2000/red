/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';

import { DALTypes } from '../../../../common/enums/DALTypes';
import { processPropertyAssets } from './propertyAssets';

import loggerModule from '../../../../common/helpers/logger';
import { saveAsset } from './assetsS3Upload';
import { processMarketingAsset, MARKETING_ASSETS } from './marketingAssets';

const logger = loggerModule.child({ subType: 'fileUpload' });

const CATEGORY_EMPLOYEES = 'Employees';
const CATEGORY_PROPERTIES = 'Properties';
const CATEGORY_ASSETS = MARKETING_ASSETS;
const ASSET_AVATAR = 'avatar';

const processEmployee = async (ctx, { filePath, folders: [externalUniqueId], rootDirectory }) => {
  const parsedPath = path.parse(filePath);
  const entity = {
    type: parsedPath.name === ASSET_AVATAR ? DALTypes.AssetType.AVATAR : DALTypes.AssetType.EMPLOYEE,
    externalUniqueId,
  };
  await saveAsset(ctx, filePath, entity, rootDirectory);
};

const handlers = {
  [CATEGORY_EMPLOYEES]: processEmployee,
  [CATEGORY_PROPERTIES]: processPropertyAssets,
  [CATEGORY_ASSETS]: processMarketingAsset,
};

export const processAsset = async (ctx, filePath, folders) => {
  const [rootDirectory, category] = folders;
  folders = folders.slice(2);

  const handler = handlers[category];
  logger.trace({ ctx }, `[ASSETS] processAsset start ${filePath}`);

  let errors = [];
  if (handler) {
    errors = await handler(ctx, { filePath, folders, rootDirectory });
  } else {
    logger.warn({ ctx, category }, 'No handler was found for ');
  }

  logger.trace({ ctx }, `[ASSETS] processAsset done ${filePath}`);
  return errors;
};
