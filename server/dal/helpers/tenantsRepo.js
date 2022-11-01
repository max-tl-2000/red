/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import isEmpty from 'lodash/isEmpty';
import { encryptObjectWithSensitiveData, decryptObjectWithSensitiveData } from '../../../common/server/crypto-helper';

export const TENANT_SETTINGS_ENCRYPTION_KEY = 'tenantSettings.encryptionKey';
export const SETTINGS_SENSITIVE_DATA_PATH = 'settings.sensitiveData';

export const TENANT_SETTINGS = {
  SCREENING: 'screening',
  REMOTE_FTP: 'remoteFTP',
};

export const SENSITIVE_TENANT_SETTINGS = {
  ...TENANT_SETTINGS,
};

export const DATA_DIRECTION = {
  IN: 'IN',
  OUT: 'OUT',
};

export const TENANT_SETTINGS_SENSITIVE_FIELDS = ['password'];
const encryptSensitiveTenantSettings = tenantSettings =>
  encryptObjectWithSensitiveData(tenantSettings, TENANT_SETTINGS_SENSITIVE_FIELDS, TENANT_SETTINGS_ENCRYPTION_KEY);

const decryptSensitiveTenantSettings = tenantSettings =>
  decryptObjectWithSensitiveData(tenantSettings, TENANT_SETTINGS_SENSITIVE_FIELDS, TENANT_SETTINGS_ENCRYPTION_KEY);

const getSensitiveSettingsValues = (tenantSettings, settingField, setting) => (acc, field) => {
  if (field === settingField) {
    acc[setting] = { [field]: tenantSettings[setting][field] };
  }

  return acc;
};

const getSensitiveSettings = (tenantSettings, setting) => (acc, settingField) => {
  const sensitiveDataSettings = TENANT_SETTINGS_SENSITIVE_FIELDS.reduce(getSensitiveSettingsValues(tenantSettings, settingField, setting), {});
  return (!isEmpty(sensitiveDataSettings) && { ...sensitiveDataSettings }) || acc;
};

const getSensitiveData = tenantSettings =>
  Object.values(SENSITIVE_TENANT_SETTINGS).reduce((acc, setting) => {
    const sensitiveSettings = (tenantSettings[setting] && Object.keys(tenantSettings[setting]).reduce(getSensitiveSettings(tenantSettings, setting), {})) || {};

    return { ...acc, ...sensitiveSettings };
  }, {});

const transformTenantSettings = tenantSettings =>
  Object.values(SENSITIVE_TENANT_SETTINGS).reduce((acc, setting) => {
    if (!tenantSettings[setting]) return { ...tenantSettings };

    const redactedTenantSettings = TENANT_SETTINGS_SENSITIVE_FIELDS.reduce(
      (accum, sensitiveField) => ({ ...omit(tenantSettings, `${setting}.${sensitiveField}`) }),
      {},
    );

    return { ...redactedTenantSettings };
  }, {});

const handleSensitiveData = settings => {
  if (isEmpty(settings)) return settings;

  const sensitiveData = getSensitiveData(settings);

  const modifiedSettings = transformTenantSettings(settings);

  if (!isEmpty(sensitiveData)) {
    modifiedSettings.sensitiveData = sensitiveData;
  }

  return modifiedSettings;
};

export const prepareTenantData = (tenant, dataDirecion = DATA_DIRECTION.OUT) => {
  const { settings } = tenant || {};
  if (!settings) return tenant;

  const tenantSettings = handleSensitiveData(settings);

  if (dataDirecion === DATA_DIRECTION.IN) return { ...tenant, settings: encryptSensitiveTenantSettings(tenantSettings) };

  return { ...tenant, settings: decryptSensitiveTenantSettings(tenantSettings) };
};

const getTenant = tenant => (tenant && omit(tenant, SETTINGS_SENSITIVE_DATA_PATH)) || tenant;

export const getTenantData = tenants => {
  if (!(tenants && tenants.length)) return tenants;

  return tenants.reduce((acc, tenant) => {
    acc.push(getTenant(tenant));
    return acc;
  }, []);
};
