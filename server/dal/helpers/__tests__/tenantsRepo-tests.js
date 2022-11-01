/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import set from 'lodash/set';
import { expect } from 'chai';
import { encrypt } from '../../../../common/server/crypto-helper';
import { prepareTenantData, DATA_DIRECTION, TENANT_SETTINGS_ENCRYPTION_KEY, SETTINGS_SENSITIVE_DATA_PATH } from '../tenantsRepo';

const plainTextPassword = 'password';
const encryptedPassword = encrypt(plainTextPassword, TENANT_SETTINGS_ENCRYPTION_KEY);
const REMOTE_FTP_PASSWORD_PATH = 'remoteFTP.password';
const SCREENING_PASSWORD_PATH = 'screening.password';
const testTenant = {
  settings: {
    quote: {
      allowBaseRentAdjustmentFlag: true,
    },
    export: {
      oneToManys: false,
    },
    features: {
      enableMergeParty: true,
      exportLeaseViaFtp: true,
      enableHoneypotTrap: true,
      neanbleRenewals: false,
      duplicatePersonNotification: true,
      enableExternalCalendarIntegration: true,
    },
    remoteFTP: {
      host: 'ftp.box.com',
      user: 'user@reva.tech',
    },
    screening: {
      username: 'screeningUsername',
      originatorId: 12345,
    },
    preferences: {
      hidePropertyLifestyles: false,
    },
    communications: {
      footerNotice: 'You have received this email because you are having a conversation with the representatives of our property.',
      contactUsLink: 'https://parkmerced.com/',
      footerCopyright: '© 2018 %propertyName%, %propertyAddress%',
      defaultEmailSignature: '%fullName%\n%businessTitle%\n\n%primaryPropertyName%',
    },
    communicationOverrides: {
      customerEmails: '',
      employeeEmails: 'empl+%NAME%@reva.tech',
    },
  },
};

describe('handle tenant settings', () => {
  describe('when the settings are being set', () => {
    it('should handle sensitive data in the settings', () => {
      const tenantWithCompleteSettings = {
        ...testTenant,
      };

      set(tenantWithCompleteSettings, `settings.${REMOTE_FTP_PASSWORD_PATH}`, plainTextPassword);
      set(tenantWithCompleteSettings, `settings.${SCREENING_PASSWORD_PATH}`, plainTextPassword);

      const tenant = prepareTenantData(tenantWithCompleteSettings, DATA_DIRECTION.IN);
      const sensitiveData = get(tenant, SETTINGS_SENSITIVE_DATA_PATH);

      const remoteFTPPassword = get(tenant, REMOTE_FTP_PASSWORD_PATH);
      const screeningPassword = get(tenant, SCREENING_PASSWORD_PATH);

      const encryptedRemoteFTPPassword = get(sensitiveData, REMOTE_FTP_PASSWORD_PATH);
      const encryptedSreeningPassword = get(sensitiveData, SCREENING_PASSWORD_PATH);

      expect(tenant).to.not.be.undefined;
      expect(sensitiveData).to.not.be.undefined;
      expect(encryptedRemoteFTPPassword).to.not.be.undefined;
      expect(encryptedSreeningPassword).to.not.be.undefined;
      expect(encryptedRemoteFTPPassword).to.not.equal(plainTextPassword);
      expect(encryptedSreeningPassword).to.not.equal(plainTextPassword);
      expect(remoteFTPPassword).to.be.undefined;
      expect(screeningPassword).to.be.undefined;
      expect(get(tenant, 'settings.preferences.hidePropertyLifestyles')).to.be.false;
    });

    it('should handle settings with partial sensitive data', () => {
      const tenantWithPartialSensitiveData = {
        settings: {
          quote: {
            allowBaseRentAdjustmentFlag: true,
          },
          screening: {
            username: 'screeningUsername',
            originatorId: 12345,
            password: plainTextPassword,
          },
        },
      };

      const tenant = prepareTenantData(tenantWithPartialSensitiveData, DATA_DIRECTION.IN);
      const sensitiveData = get(tenant, SETTINGS_SENSITIVE_DATA_PATH);

      const remoteFTPPassword = get(tenant, REMOTE_FTP_PASSWORD_PATH);
      const screeningPassword = get(tenant, SCREENING_PASSWORD_PATH);

      const encryptedRemoteFTPPassword = get(sensitiveData, REMOTE_FTP_PASSWORD_PATH);
      const encryptedSreeningPassword = get(sensitiveData, SCREENING_PASSWORD_PATH);

      expect(tenant).to.not.be.undefined;
      expect(sensitiveData).to.not.be.undefined;
      expect(encryptedRemoteFTPPassword).to.be.undefined;
      expect(encryptedSreeningPassword).to.not.be.undefined;
      expect(encryptedSreeningPassword).to.not.equal(plainTextPassword);
      expect(remoteFTPPassword).to.be.undefined;
      expect(screeningPassword).to.be.undefined;
      expect(get(tenant, 'settings.quote.allowBaseRentAdjustmentFlag')).to.be.true;
    });

    it('should handle settings containing no sensitive data', () => {
      const tenantWithNoSensitiveData = {
        settings: {
          quote: {
            allowBaseRentAdjustmentFlag: false,
          },
        },
      };

      const tenant = prepareTenantData(tenantWithNoSensitiveData, DATA_DIRECTION.IN);
      const sensitiveData = get(tenant, SETTINGS_SENSITIVE_DATA_PATH);

      const remoteFTPPassword = get(tenant, REMOTE_FTP_PASSWORD_PATH);
      const screeningPassword = get(tenant, SCREENING_PASSWORD_PATH);

      const encryptedRemoteFTPPassword = get(sensitiveData, REMOTE_FTP_PASSWORD_PATH);
      const encryptedSreeningPassword = get(sensitiveData, SCREENING_PASSWORD_PATH);

      expect(tenant).to.not.be.undefined;
      expect(sensitiveData).to.be.undefined;
      expect(encryptedRemoteFTPPassword).to.be.undefined;
      expect(encryptedSreeningPassword).to.be.undefined;
      expect(remoteFTPPassword).to.be.undefined;
      expect(screeningPassword).to.be.undefined;
      expect(get(tenant, 'settings.quote.allowBaseRentAdjustmentFlag')).to.be.false;
    });

    it('should handle empty settings', () => {
      expect(prepareTenantData({}, DATA_DIRECTION.IN)).to.be.empty;
      expect(prepareTenantData(), DATA_DIRECTION.IN).to.be.empty;
    });
  });

  describe('when getting the settings', () => {
    it('should handle sensitive data in the settings', () => {
      const tenantWithCompleteSettings = {
        ...testTenant,
      };

      set(tenantWithCompleteSettings, `${SETTINGS_SENSITIVE_DATA_PATH}.${REMOTE_FTP_PASSWORD_PATH}`, encryptedPassword);
      set(tenantWithCompleteSettings, `${SETTINGS_SENSITIVE_DATA_PATH}.${SCREENING_PASSWORD_PATH}`, encryptedPassword);

      const tenant = prepareTenantData(tenantWithCompleteSettings, DATA_DIRECTION.OUT);

      const decryptedRemoteFTPPassword = get(tenant, `${SETTINGS_SENSITIVE_DATA_PATH}.${REMOTE_FTP_PASSWORD_PATH}`);
      const decryptedSreeningPassword = get(tenant, `${SETTINGS_SENSITIVE_DATA_PATH}.${SCREENING_PASSWORD_PATH}`);

      expect(tenant).to.not.be.undefined;
      expect(decryptedRemoteFTPPassword).to.not.be.undefined;
      expect(decryptedSreeningPassword).to.not.be.undefined;
      expect(decryptedRemoteFTPPassword).to.equal(plainTextPassword);
      expect(decryptedSreeningPassword).to.equal(plainTextPassword);
      expect(get(tenant, 'settings.preferences.hidePropertyLifestyles')).to.be.false;
    });

    it('should handle settings with partial sensitive data', () => {
      const tenantWithPartialSensitiveData = {
        settings: {
          quote: {
            allowBaseRentAdjustmentFlag: true,
          },
          screening: {
            username: 'screeningUsername',
            originatorId: 12345,
          },
        },
      };

      set(tenantWithPartialSensitiveData, `${SETTINGS_SENSITIVE_DATA_PATH}.${SCREENING_PASSWORD_PATH}`, encryptedPassword);

      const tenant = prepareTenantData(tenantWithPartialSensitiveData, DATA_DIRECTION.OUT);

      const decryptedRemoteFTPPassword = get(tenant, `${SETTINGS_SENSITIVE_DATA_PATH}.${REMOTE_FTP_PASSWORD_PATH}`);
      const decryptedSreeningPassword = get(tenant, `${SETTINGS_SENSITIVE_DATA_PATH}.${SCREENING_PASSWORD_PATH}`);

      expect(tenant).to.not.be.undefined;
      expect(decryptedRemoteFTPPassword).to.be.undefined;
      expect(decryptedSreeningPassword).to.not.be.undefined;
      expect(decryptedSreeningPassword).to.equal(plainTextPassword);
      expect(get(tenant, 'settings.quote.allowBaseRentAdjustmentFlag')).to.be.true;
    });

    it('should handle settings containing no sensitive data', () => {
      const tenantWithNoSensitiveData = {
        settings: {
          quote: {
            allowBaseRentAdjustmentFlag: false,
          },
        },
      };

      const tenant = prepareTenantData(tenantWithNoSensitiveData, DATA_DIRECTION.OUT);

      const decryptedRemoteFTPPassword = get(tenant, `sensitiveData.${REMOTE_FTP_PASSWORD_PATH}`);
      const decryptedSreeningPassword = get(tenant, `sensitiveData.${SCREENING_PASSWORD_PATH}`);

      expect(tenant).to.not.be.undefined;
      expect(decryptedRemoteFTPPassword).to.be.undefined;
      expect(decryptedSreeningPassword).to.be.undefined;
      expect(get(tenant, 'settings.quote.allowBaseRentAdjustmentFlag')).to.be.false;
    });

    it('should handle empty settings', () => {
      expect(prepareTenantData({}, DATA_DIRECTION.OUT)).to.be.empty;
      expect(prepareTenantData(), DATA_DIRECTION.OUT).to.be.empty;
    });
  });
});
