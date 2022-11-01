/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import escape from 'lodash/escape';
import groupBy from 'lodash/groupBy';
import path from 'path';
import { read } from '../../common/helpers/xfs';
import { formatAssetUrl } from '../workers/upload/uploadUtil';
import { fillHandlebarsTemplate } from '../../common/helpers/handlebars-utils';
import { DALTypes } from '../../common/enums/DALTypes';

const escapeContent = (input = '') => escape(input);

export const buildPropertyAssetsSitemap = async (ctx, { propertyAssets, unitsAssociatedToLayouts = [] }) => {
  const sitemapTeamplate = await read(path.resolve(__dirname, '../resources/property-sitemap-template.xml'), {
    encoding: 'utf8',
  });

  const groupedAssets = groupBy(propertyAssets || [], 'propertyName');

  const assets = Object.keys(groupedAssets).map(key => ({
    propertyName: key,
    images: groupedAssets[key].map(({ physicalAssetId, caption, assetType, name }) => ({
      imageType: assetType.toLowerCase(),
      url: formatAssetUrl(ctx.tenantId, physicalAssetId),
      caption,
      shouldAddNameAttribute: assetType === DALTypes.AssetType.LAYOUT,
      name,
    })),
    units: (unitsAssociatedToLayouts || []).filter(({ propertyName }) => propertyName === key),
  }));

  return await fillHandlebarsTemplate(sitemapTeamplate, { assets }, { escapeContent });
};
