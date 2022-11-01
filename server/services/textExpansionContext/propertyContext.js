/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';
import { getPropertyByIdQuery } from '../../dal/propertyRepo';
import { formatSimpleAddress } from '../../../common/helpers/addressUtils';
import { getPropertyImage, getImageForEmail } from '../../../common/helpers/cloudinary';
import { formatPropertyAssetUrl } from '../../helpers/assets-helper';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { propertyId }) => getPropertyByIdQuery(ctx, propertyId).toString();

export const tokensMapping = {
  templateDisplayName: 'displayName', // deprecated
  displayName: 'displayName',
  address: formatSimpleAddress,
  privacyUrl: ({ settings }) => (settings.application || {}).urlPropPolicy,
  websiteUrl: 'website',
  contactUrl: ({ tenantSettings }) => (tenantSettings.communications || {}).contactUsLink,
  heroImageUrl: async ({ id: propertyId }, { ctx, tokenParams }) => {
    const propertyAssetUrl = await formatPropertyAssetUrl(ctx, propertyId, { permaLink: true, from: 'template' });
    return tokenParams.length ? getImageForEmail(propertyAssetUrl, tokenParams) : getPropertyImage(propertyAssetUrl, { width: 1200 });
  },
  applicationName: ({ settings }) => settings?.rxp?.app?.name,
};
