/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import notifier from '../notifier/notifier';
import { delayedLogout } from '../auth-helper';
import { formatPhoneNumber } from '../strings';
import * as tenantsStore from '../../redux/modules/tenantsStore';

export const handleTenantPhoneAssignationSuccess = dispatch => tenant => {
  if (tenant.metadata.phoneNumbers.length) {
    const nos = tenant.metadata.phoneNumbers.map(p => formatPhoneNumber(p.phoneNumber)).join(', ');

    notifier.success(
      t('PHONENO_ASSIGNATION_SUCCESS', {
        phoneNumbers: nos,
        name: tenant.name,
      }),
    );
  } else {
    notifier.success(t('PHONENO_REMOVE_SUCCESS', { name: tenant.name }));
  }
  dispatch(tenantsStore.editTenantPhoneNumbersDone(tenant));
  dispatch(tenantsStore.loadAvailablePhoneNumbers());
};

export const handleTenantUpdateSuccess = dispatch => tenant => {
  notifier.success(t('TENANT_UPDATE_SUCCESS'));
  dispatch(tenantsStore.updateTenantDone(tenant));
};

export const handleCommServiceSetupComplete = dispatch => ({ tenant, successfully }) => {
  if (successfully) {
    notifier.success(t('COMM_PROVIDER_SETUP_SUCCESS', { name: tenant.name }));
    dispatch(tenantsStore.createTenantDone(tenant));
  } else {
    notifier.error(t('COMM_PROVIDER_SETUP_FAIL', { name: tenant.name }));
  }
};

export const handleTenantPhoneAssignationFailure = dispatch => tenant => {
  notifier.success(t('PHONENO_ASSIGNATION_FAILURE', { name: tenant.name }));
  dispatch(tenantsStore.editTenantPhoneNumbersDone(tenant));
  dispatch(tenantsStore.loadAvailablePhoneNumbers());
};

export const handleTenantRefreshSchemaDone = dispatch => ({ tenantId, successfully }) => {
  dispatch(tenantsStore.refreshTenantSchemaDone(tenantId));
  if (successfully) {
    notifier.success(t('REFRESH_TENANT_SCHEMA_DONE'));
    dispatch(tenantsStore.loadTenant(tenantId));
  } else {
    notifier.error(t('REFRESH_TENANT_SCHEMA_FAIL'));
  }
};

export const handleTenantClearSchemaDone = dispatch => ({ successfully }) => {
  dispatch(tenantsStore.clearTenantSchemaDone());
  if (successfully) {
    delayedLogout();
  } else {
    notifier.error(t('CLEAR_TENANT_SCHEMA_FAIL'));
  }
};

export const handleCommProviderCleanupDone = dispatch => ({ error }) => {
  dispatch(tenantsStore.commProviderCleanupDone());
  if (error) notifier.error(t('COMM_PROVIDER_CLEANUP_ERROR'));
};

export const handlePasswordChange = ({ tenantName, type, successfully }) => {
  successfully && notifier.success(t('PASSWORD_UPDATED_FOR_TENANT', { tenant: tenantName, type }));
  !successfully && notifier.error(t('FAILED_TO_UPDATE_PASSWORD', { tenant: tenantName, type }));
};

export const handleGetAvailableNumbersDone = dispatch => ({ tenantNumbers, successfully }) => {
  if (successfully) {
    dispatch(tenantsStore.loadAvailablePhoneNumbersDone(tenantNumbers));
  } else {
    dispatch(tenantsStore.loadAvailablePhoneNumbersFailed());
  }
};
