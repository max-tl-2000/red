/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const getUrlParams = ({ tenantName, cloudEnv }, apiToken) => `env=${cloudEnv}&tenant=${tenantName}&api-token=${apiToken}`;

export const formatStaticAssetUrl = (ctx, assetName, assetType) => {
  const { isPublicEnv, domainSuffix, reverseProxyUrl, rpImageToken, cloudEnv } = ctx;

  if (!domainSuffix || !reverseProxyUrl || !rpImageToken || !cloudEnv || !assetName || !assetType) return '';

  const staticAssetsBaseUrl = isPublicEnv ? `https://static.${domainSuffix}/images` : `${reverseProxyUrl}/images`;
  const assetUrl = `${staticAssetsBaseUrl}/${assetType.toLowerCase()}/${assetName}`;

  return isPublicEnv ? assetUrl : `${assetUrl}?${getUrlParams({ cloudEnv, tenantName: 'static' }, rpImageToken)}`;
};
