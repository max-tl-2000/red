/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fs from 'fs';
import { DALTypes } from '../../common/enums/DALTypes';
import { formatEntityAssetUrl } from './tenantContextConfigs';
import loggerModule from '../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'assetsHelper' });

// this regular expression is not understood by firefox
// by moving it here (server side), where it is used it fixes the issue
const ASSET_TAGS_BETWEEN_HYPHENS = /(?<=-)([a-z]{2})(?=-)/gi;
const ASSET_RANK_LABEL = /(\d{1,3})\s*-{0,1}\s*(.*)/i;
const ASSET_URL_SCAPE_CHARACTERS = /[\s#$%&@`\/:;<=>?[\\\]^{|}~"'+,]/gi; // eslint-disable-line no-useless-escape

const extractCharacters = (searchExpression, indexToExtract) => text => {
  let textExtracted;
  const result = new Set();

  do {
    textExtracted = searchExpression.exec(text);
    textExtracted && result.add(textExtracted[indexToExtract]);
  } while (textExtracted);
  return Array.from(result);
};

const isTagOfType = type => tag => !!tag && tag.toUpperCase() === type.toUpperCase();

export const parseMetadataInFilePath = filePath => {
  const fileName = path.parse(filePath).name;
  const extractTags = extractCharacters(ASSET_TAGS_BETWEEN_HYPHENS, 1);

  const tags = extractTags(fileName);
  const tagsInName = tags.length ? `${tags.join('-')}-` : '';
  const [, rankExtracted, labelExtracted = ''] = fileName.match(ASSET_RANK_LABEL) || [];

  const highValue = tags.some(isTagOfType('HV'));
  const floorPlan = tags.some(isTagOfType('FP'));
  const rank = rankExtracted ? parseInt(rankExtracted, 10) : 0; // no ranking information
  const label = labelExtracted.substring(labelExtracted.indexOf(tagsInName) + tagsInName.length);

  return { highValue, floorPlan, rank, label };
};

export const parseMetadataInRxpFilePath = (ctx, filePath) => {
  const fileName = path.parse(filePath).name;
  const fileNameParts = fileName.split('-'); // ex: 64x64-square-dark.png

  if (fileNameParts.length < 3) {
    logger.error({ ctx, filePath }, 'Rxp asset name does not contain the required info');
    throw new Error('INCORRECT_RXP_ASSET_NAME');
  }

  const themeNameParts = fileNameParts[fileNameParts.length - 1].split('.');

  return {
    dimensions: fileNameParts[0],
    shape: fileNameParts[1],
    theme: themeNameParts[0], // without file extension
  };
};

export const validateMarketingAsset = (filePath, { fileSize = 2.5, fileNameLength = 255 } = {}) => {
  const fileName = path.parse(filePath).base;
  const errors = [];

  const extractInvalidCharacters = extractCharacters(ASSET_URL_SCAPE_CHARACTERS, 0);
  const invalidCharacters = extractInvalidCharacters(fileName);
  invalidCharacters.length && errors.push({ token: 'INVALID_CHARACTERS', message: invalidCharacters.join('') });

  fileName.length > fileNameLength && errors.push({ token: 'INVALID_FILENAME_SIZE', message: `Limited to ${fileNameLength} charcaters` });

  const { size } = fs.statSync(filePath);
  const maxSizeInBytes = fileSize * 1000 * 1000;
  size > maxSizeInBytes && errors.push({ token: 'INVALID_FILE_SIZE', message: `Limited to ${fileSize} megabytes` });

  return { success: !errors.length, errors };
};

export const formatEmployeeAssetUrl = async (ctx, entityId, options) => await formatEntityAssetUrl(ctx, entityId, DALTypes.AssetType.EMPLOYEE, options);

export const formatInventoryAssetUrl = async (ctx, entityId, options) => await formatEntityAssetUrl(ctx, entityId, DALTypes.AssetType.INVENTORY, options);

export const formatPropertyAssetUrl = async (ctx, entityId, options) => await formatEntityAssetUrl(ctx, entityId, DALTypes.AssetType.PROPERTY, options);
