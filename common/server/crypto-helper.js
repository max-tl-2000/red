/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import crypto from 'crypto';
import get from 'lodash/get';
import set from 'lodash/set';
import has from 'lodash/has';
import { commonConfig as config } from '../server-config';
import nullish from '../helpers/nullish';

import logger from '../helpers/logger';

const DEFAULT_ENCRYPTION_CONFIG_KEY = 'auth.longEncryptionKey';

export const OLD_ENCRYPTION_CONFIG_KEY = 'auth.encryptionKey';

const REVA_ENCRYPTION_TAG = '{ENCRYPTED}:';

const { encryptionAlgorithm, encryptionAlgorithmKeySize, encryptionAlgorithmIvSize } = config.auth;

export const encryptWithKey = (text, encryptionKey, initializationVector) => {
  const cipher = crypto.createCipheriv(encryptionAlgorithm, encryptionKey.slice(0, encryptionAlgorithmKeySize), initializationVector);
  let encryptedText = cipher.update(text, 'utf8', 'base64');
  encryptedText += cipher.final('base64');

  return `${REVA_ENCRYPTION_TAG}${initializationVector}:${encryptedText}`;
};

const transformFieldsInObject = (obj, fieldPaths, configKeyName, transformer) => {
  if (nullish(obj)) return obj;
  return fieldPaths.reduce((acc, fieldPath) => {
    if (!has(acc, fieldPath)) return acc;
    const origVal = get(acc, fieldPath);
    const newVal = transformer(origVal, configKeyName);
    set(acc, fieldPath, newVal);
    return acc;
  }, JSON.parse(JSON.stringify(obj)));
};

export const encrypt = (text, configKeyName = DEFAULT_ENCRYPTION_CONFIG_KEY) => {
  if (nullish(text)) return text;
  const encryptionKey = get(config, configKeyName);
  const initializationVector = crypto.randomBytes(encryptionAlgorithmIvSize).toString('base64').slice(0, encryptionAlgorithmIvSize);

  if (encryptionKey) return encryptWithKey(text, encryptionKey, initializationVector);

  if (config.isProd) {
    throw new Error('attempt to encrypt in production without a valid encryption key');
  } else {
    logger.warn(`could not find encryption key ${configKeyName} - will use default one from ${DEFAULT_ENCRYPTION_CONFIG_KEY} instead`);
    const defaultKey = get(config, DEFAULT_ENCRYPTION_CONFIG_KEY);
    return encryptWithKey(text, defaultKey, initializationVector);
  }
};

export const encryptFieldsInObject = (obj, fieldPaths, configKeyName) => transformFieldsInObject(obj, fieldPaths, configKeyName, encrypt);

// This were the old methods used for creating the jwt tokens encryption/decryption.
export const encryptWithOldKey = text => {
  const oldDecryptionKey = get(config, OLD_ENCRYPTION_CONFIG_KEY);
  const cipher = crypto.createCipher(encryptionAlgorithm, oldDecryptionKey);
  let encryptedText = cipher.update(text, 'utf8', 'base64');
  encryptedText += cipher.final('base64');
  return encryptedText;
};

export const decryptWithOldKey = text => {
  const oldDecryptionKey = get(config, OLD_ENCRYPTION_CONFIG_KEY);
  const decipher = crypto.createDecipher(encryptionAlgorithm, oldDecryptionKey);
  let decryptedText = decipher.update(text, 'base64', 'utf8');
  decryptedText += decipher.final('utf8');
  return decryptedText;
};

export const decryptWithKey = (text, decryptionKey) => {
  if (nullish(text)) return text;

  if (!text.startsWith(REVA_ENCRYPTION_TAG)) {
    return decryptWithOldKey(text);
  }

  const initializationVector = text.split(':')[1];
  const decipher = crypto.createDecipheriv(encryptionAlgorithm, decryptionKey.slice(0, encryptionAlgorithmKeySize), initializationVector);

  const encryptedValue = text.substring(REVA_ENCRYPTION_TAG.length + encryptionAlgorithmIvSize + 1);
  let decryptedText = decipher.update(encryptedValue, 'base64', 'utf8');
  decryptedText += decipher.final('utf8');

  return decryptedText;
};

export const decrypt = (text, configKeyName = DEFAULT_ENCRYPTION_CONFIG_KEY) => {
  if (nullish(text)) return text;
  const decryptionKey = get(config, configKeyName);

  return decryptWithKey(text, decryptionKey);
};

export const decryptFieldsInObject = (obj, fieldPaths, configKeyName) => transformFieldsInObject(obj, fieldPaths, configKeyName, decrypt);

const handleObjectEncryption = (obj, encryptionKeyName, transformer, props = ['password']) => {
  if (!(obj && props.length)) return obj;

  const replacer = (key, value) => {
    if (props.some(property => property && property === key)) {
      return transformer(value, encryptionKeyName);
    }

    return value;
  };

  return JSON.parse(JSON.stringify(obj, replacer));
};

export const encryptObjectWithSensitiveData = (obj, sensitiveFields, encryptionKeyName) =>
  handleObjectEncryption(obj, encryptionKeyName, encrypt, sensitiveFields);

export const decryptObjectWithSensitiveData = (obj, sensitiveFields, encryptionKeyName) =>
  handleObjectEncryption(obj, encryptionKeyName, decrypt, sensitiveFields);
