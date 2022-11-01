/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import nullish from './nullish';
import { location } from './globals';
import { getMetaFromNameWithBgColor } from './avatar-helpers';
import { HTTP_PROTOCOL } from '../regex';
import { formatStaticAssetUrl } from './assets';
import { StaticAssetType } from '../enums/enums';
import { encodeBase64Url } from './strings';

const matchCucumber = str => str && str.toLowerCase().match(/^cucumber/);
const settings = {
  forcePNG: false,
  tenantName: '',
  cloudName: '',
  isPublicEnv: '',
  isDevelopment: false,
  domainSuffix: '',
  reverseProxyUrl: '',
  rpImageToken: '',
  cloudEnv: '',
  url: 'https://res.cloudinary.com',
  // we need to skip cloudinary in cucumber to avoid exceed the quota
  skipCloudinary: matchCucumber(location?.hostname), // TODO: move this to the client.js files
};

const getUrlParameters = options => (options && options.length > 0 ? `${options.filter(opt => !!opt).join(',')}/` : '');
const getUrlLayers = layers => (layers && layers.length > 0 ? `${layers.filter(layer => !!layer).join('/')}/` : '');

const isCloudinaryUrl = (url = '') => url.startsWith(settings.url);

export const buildCloudinaryUrl = (imageNameOrUrl, { imageFolder = 'fetch', buildParameters }) => {
  if (isCloudinaryUrl(imageNameOrUrl) || settings.skipCloudinary) return imageNameOrUrl;
  if (!imageNameOrUrl) return ''; // if not imageNameOrUrl, just return an empty string

  const { cloudName, url, isDevelopment } = settings;
  if (cloudName && !isDevelopment) {
    return `${url}/${cloudName}/image/${imageFolder}/${buildParameters()}${encodeURIComponent(imageNameOrUrl)}`;
  }

  // In case of error, jsut return the url. Error('cloudinary cloudName not set');
  return imageNameOrUrl;
};

export const getUrlFromCloudinary = (imageUrl, options = [], layers = []) => {
  if (!imageUrl) return '';

  if (imageUrl.includes('reva.tech/api/images')) {
    const delimiter = imageUrl.match(/\?.*?=/) ? '&' : '?';
    const cloudinaryParams = options.length ? `${delimiter}cParams=${options.filter(x => x).join(',')}` : '';
    return `${imageUrl}${cloudinaryParams}`;
  }

  return buildCloudinaryUrl(imageUrl, { imageFolder: 'fetch', buildParameters: () => `${getUrlParameters(options)}${getUrlLayers(layers)}` });
};

const formatAvatarStaticAssetUrl = (assetName, assetType, encode = true) => {
  const staticAssetUrl = formatStaticAssetUrl(settings, assetName, assetType);
  return encode ? encodeBase64Url(staticAssetUrl) : staticAssetUrl;
};

const getFallbackAvatar = (imageBgUrl, initials, customParamaters, layers) =>
  buildCloudinaryUrl(imageBgUrl, {
    imageFolder: 'fetch',
    buildParameters: () => {
      const avatarInitials = initials === '?' ? '%5E.%5E' : initials;
      const textLayer = `/l_text:Roboto_16_regular:${avatarInitials},co_rgb:000000DD/`;
      const designParameters = getUrlParameters([
        'ar_1:1',
        'c_fill',
        'f_auto',
        'r_max',
        'fl_force_strip',
        'cs_no_cmyk',
        'q_auto:good',
        'fl_preserve_transparency',
        ...customParamaters,
      ]);

      return `${designParameters}${textLayer}${getUrlLayers(layers)}`;
    },
  });

const isUrl = imageUrl => (imageUrl.match(HTTP_PROTOCOL) || []).length;

const formatAvatarMask = (hasBadgeIcon, size, zoomLevel) =>
  hasBadgeIcon
    ? formatAvatarStaticAssetUrl(`avatar_badge_${size}${zoomLevel}.png`, StaticAssetType.MASKS)
    : formatAvatarStaticAssetUrl(`avatar_${size}${zoomLevel}.png`, StaticAssetType.MASKS);

const getMaskZoomLevel = dpr => (dpr === 1 ? '' : `@${dpr}x`);
const getAvatarMask = ({ hasBadgeIcon, dpr, size }) => `l_fetch:${formatAvatarMask(hasBadgeIcon, size, getMaskZoomLevel(dpr))},fl_cutter`;

const avatarSettingsBySizeMapping = {
  32: ({ hasBadgeIcon, dpr }) => ({ params: ['w_32'], layers: [getAvatarMask({ hasBadgeIcon, dpr, size: 32 })] }),
  40: ({ hasBadgeIcon, dpr }) => ({ params: ['w_40', 'z_0.9'], layers: [getAvatarMask({ hasBadgeIcon, dpr, size: 40 })] }),
  56: ({ hasBadgeIcon, dpr }) => ({ params: ['w_56', 'z_0.8'], layers: [getAvatarMask({ hasBadgeIcon, dpr, size: 56 })] }),
  64: ({ hasBadgeIcon, dpr }) => ({ params: ['w_64', 'z_0.7'], layers: [getAvatarMask({ hasBadgeIcon, dpr, size: 64 })] }),
};

const formatDpr = dpr => `dpr_${dpr}.0`;

export const getSmallAvatar = (imageUrl, displayName = '', avatarSize = 40, hasBadgeIcon = false, dpr = 1, isRenewalOrActiveLease = false) => {
  const getSettings = avatarSettingsBySizeMapping[avatarSize];
  const avatarSettings = getSettings ? getSettings({ hasBadgeIcon, dpr }) : { params: [], layers: [] };
  const parameters = [formatDpr(dpr), ...avatarSettings.params];

  if (!imageUrl) {
    const { initials, color: imageBgName } = getMetaFromNameWithBgColor(displayName, false, isRenewalOrActiveLease);
    const imageBgUrl = formatAvatarStaticAssetUrl(imageBgName, StaticAssetType.SWATCHES, false);
    return getFallbackAvatar(imageBgUrl, initials, parameters, avatarSettings.layers);
  }

  if (!isUrl(imageUrl)) return imageUrl;

  return getUrlFromCloudinary(
    imageUrl,
    [
      'ar_1:1',
      'c_thumb',
      'g_face:center',
      settings.forcePNG ? 'f_png' : 'f_auto',
      'q_auto:good',
      'r_max',
      'e_auto_brightness',
      'fl_force_strip',
      'cs_no_cmyk',
      ...parameters,
    ],
    avatarSettings.layers,
  );
};

export const getBigAvatar = imageUrl =>
  getUrlFromCloudinary(imageUrl, [
    'w_64',
    'z_0.8',
    'ar_1:1',
    'c_thumb',
    'g_face:center',
    settings.forcePNG ? 'f_png' : 'f_auto',
    'q_auto:good',
    'r_max',
    'e_auto_brightness',
    'fl_force_strip',
  ]);

export const getPropertyImage = (imageUrl, { width, height } = {}) => {
  let widthParam = '';
  let heightParam = '';

  if (!nullish(width)) {
    widthParam = `w_${width}`;
  }

  if (!nullish(height)) {
    heightParam = `h_${height}`;
  }

  return getUrlFromCloudinary(imageUrl, [
    widthParam,
    heightParam,
    'ar_2.35',
    'f_auto',
    'c_fill',
    'q_auto:good',
    'g_auto:no_faces',
    'e_improve',
    'e_auto_brightness',
    'fl_force_strip',
  ]);
};

export const getLayoutImage = (imageUrl, { width, height, aspectRatio } = {}) => {
  let widthParam = '';
  let heightParam = '';
  let aspectRatioParam = '';

  if (!nullish(width)) {
    widthParam = `w_${width}`;
  }

  if (!nullish(height)) {
    heightParam = `h_${height}`;
  }

  if (!nullish(aspectRatio)) {
    aspectRatioParam = `ar_${aspectRatio}`;
  }

  return getUrlFromCloudinary(imageUrl, [
    widthParam,
    heightParam,
    aspectRatioParam,
    'c_fill',
    'g_auto:no_faces',
    'f_auto',
    'q_auto:good',
    'e_improve',
    'e_auto_brightness',
    'fl_force_strip',
  ]);
};

export const getImageForEmail = (imageUrl, imageParams) => {
  const validParams = imageParams
    .filter(param => ['w', 'h', 'ar', 'r'].includes(param.key) && !nullish(param.value))
    .map(param => `${param.key}_${param.value}`);

  return getUrlFromCloudinary(imageUrl, [
    ...validParams,
    'c_fill',
    'g_auto:no_faces',
    'f_auto',
    'q_auto:good',
    'e_improve',
    'e_auto_brightness',
    'fl_force_strip',
  ]);
};

export const getLargeLayoutImage = imageUrl => getLayoutImage(imageUrl, { height: 168, aspectRatio: '3:4' });

export const getSmallLayoutImage = imageUrl => getLayoutImage(imageUrl, { width: 272, aspectRatio: '16:9' });

export const getBigLayoutImage = imageUrl => getLayoutImage(imageUrl, { height: 200, aspectRatio: '16:9' });

export const getEmailLayoutImage = imageUrl => getLayoutImage(imageUrl, { width: 1200, aspectRatio: '2.35' });

export const init = ({ forcePNG, cloudName, tenantName, isPublicEnv, domainSuffix, reverseProxyUrl, rpImageToken, cloudEnv, isDevelopment }) => {
  settings.forcePNG = forcePNG;
  settings.cloudName = cloudName;
  settings.tenantName = tenantName;
  settings.isPublicEnv = isPublicEnv;
  settings.domainSuffix = domainSuffix;
  settings.reverseProxyUrl = reverseProxyUrl;
  settings.rpImageToken = rpImageToken;
  settings.cloudEnv = cloudEnv;
  settings.isDevelopment = isDevelopment;
};
