/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import hasha from 'hasha';
import config from '../../config';
import { now, formatMoment } from '../../../common/helpers/moment-utils';

export const getRelativeUploadPath = (ctx, filePath) => filePath.replace(ctx.uploadFolder, '');

const importResultsPath = 'importResults';
const originalImportFilesPath = 'originalImportFiles';
const latestPath = 'latest';
const exportPath = 'export';
const fullDatePrefixedPaths = [originalImportFilesPath, exportPath];
const datePrefixedPaths = [importResultsPath, ...fullDatePrefixedPaths];

const keyPrefix = tenantId => `${process.env.CLOUD_ENV}/tenants/${tenantId}`;

export const getTenantKeyPrefix = tenantId => keyPrefix(tenantId);
export const getKeyPrefixForAssets = tenantId => `${keyPrefix(tenantId)}/images`;
export const getKeyPrefixForPublicDocuments = tenantId => `${keyPrefix(tenantId)}/publicDocuments`;
export const getKeyPrefixForVoiceMessages = tenantId => `${keyPrefix(tenantId)}/voiceMessages`;
export const getKeyPrefixForInventory = tenantId => `${keyPrefix(tenantId)}/importResults`;
export const getKeyPrefixForConversion = tenantId => `${keyPrefix(tenantId)}/conversionResults`;
export const getKeyPrefixForSignedLeaseDocuments = (tenantId, envelopeId) => `${keyPrefix(tenantId)}/signedLeaseDocuments/${envelopeId}`;
export const getDocumentsKeyPrefix = tenantId => `${keyPrefix(tenantId)}/documents`;
export const getKeyPrefixForExportedDatabase = tenantId => `${keyPrefix(tenantId)}/exportedDatabase`;

const getDateKeyPrefix = (relativePath = '') => {
  if (!datePrefixedPaths.includes(relativePath)) return '';

  const _now = now();
  const fullDate = formatMoment(_now, { format: 'YYYY/MM/DD' });
  const yearAndMonth = formatMoment(_now, { format: 'YYYY/MM' });

  return (fullDatePrefixedPaths.includes(relativePath) && fullDate) || yearAndMonth;
};

const getBasePrefix = (tenantId, relativePath) => `${keyPrefix(tenantId)}/${relativePath}`;

export const getLatestDirForPath = path => `${path}/${latestPath}`;

const getDatedKeyPrefix = (tenantId, relativePath, includeDatedPrefix) => {
  const baseKeyPrefix = getBasePrefix(tenantId, relativePath);
  const datedKeyPrefix = getDateKeyPrefix(relativePath);

  return (includeDatedPrefix && `${baseKeyPrefix}/${datedKeyPrefix}`) || baseKeyPrefix;
};

export const getKeyPrefixForImportUpdates = (tenantId, includeDatedPrefix = true) => getDatedKeyPrefix(tenantId, importResultsPath, includeDatedPrefix);

export const getOriginalImportFilesKeyPrefix = (tenantId, includeDatedPrefix = true) =>
  getDatedKeyPrefix(tenantId, originalImportFilesPath, includeDatedPrefix);

export const getOriginalImportFilesLatestKeyPrefix = tenantId => getLatestDirForPath(getBasePrefix(tenantId, originalImportFilesPath));

export const getExportsKeyPrefix = (tenantId, includeDatedPrefix = true) => getDatedKeyPrefix(tenantId, exportPath, includeDatedPrefix);

export const getAssetsBucket = () => config.aws.s3AssetsBucket;
export const getPrivateBucket = () => config.aws.s3PrivateBucket;
export const getURLShortenerBucket = () => config.aws.s3ShortenerBucket;

export const getEncryptionKeyId = () => config.aws.s3EncryptionKeyId;

const formatS3Url = (tenantId, fileName, getKeyPrefix) =>
  !tenantId || !fileName ? '' : `https://s3.amazonaws.com/${getAssetsBucket()}/${getKeyPrefix(tenantId)}/${fileName}`;

export const formatAssetUrl = (tenantId, uuid) => formatS3Url(tenantId, uuid, getKeyPrefixForAssets);

export const formatImportResultsFileUrl = (tenantId, fileName) => formatS3Url(tenantId, fileName, getKeyPrefixForInventory);

export const formatConversionResultsFileUrl = (tenantId, fileName) => formatS3Url(tenantId, fileName, getKeyPrefixForConversion);

export const formatVoiceRecordingUrl = (tenantId, fileName) => formatS3Url(tenantId, fileName, getKeyPrefixForVoiceMessages);

export const getFileChecksum = async (filePath, algorithm = 'md5') => await hasha.fromFile(filePath, { algorithm });
