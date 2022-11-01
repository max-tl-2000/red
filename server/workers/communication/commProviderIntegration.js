/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { isEqual, differenceBy } from 'lodash'; // eslint-disable-line red/no-lodash
import { getTenantData, updateTenantPhoneNumbers } from '../../dal/tenantsRepo';
import { getTenant } from '../../services/tenantService';
import { admin } from '../../common/schemaConstants';
import logger from '../../../common/helpers/logger';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import * as plivoServiceOps from './adapters/plivoServiceAdapter';
import * as fakeServiceOps from './adapters/fakeServiceAdapter';

const isPhoneSupportEnabled = tenant => tenant.metadata && tenant.metadata.enablePhoneSupport;
const getProviderOps = phoneSupportEnabled => (phoneSupportEnabled ? plivoServiceOps : fakeServiceOps);

export const getAvailableNumbers = (phoneSupportEnabled = true, usedByCucumber = false) =>
  getProviderOps(phoneSupportEnabled).getAvailableNumbers(usedByCucumber);

export const deassignPhoneNumbers = (numbersToDeassign, phoneSupportEnabled = true) =>
  getProviderOps(phoneSupportEnabled).deassignPhoneNumbers(numbersToDeassign);

export const onTenantCreated = async tenant => {
  logger.debug('onTenantCreated');
  try {
    const updatedTenant = await getProviderOps(isPhoneSupportEnabled(tenant)).setupTenant(tenant);
    logger.info({ tenantName: tenant.name }, `Communication service was set up successfully for tenant '${tenant.name}'`);
    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.COMM_PROVIDER_SETUP_DONE,
      data: { tenant: updatedTenant, successfully: true },
    });
    return { processed: true };
  } catch (error) {
    logger.error({ error }, `Communication service setup failed for tenant '${tenant.name}'`);
    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.COMM_PROVIDER_SETUP_DONE,
      data: { tenant, successfully: false },
    });
    return { processed: false };
  }
};

export const onTenantRemoved = async ({ tenant, ...rest }) => {
  logger.info('Deassign phone numbers and remove provider data for tenant - start');
  if (tenant.metadata) {
    await getProviderOps(isPhoneSupportEnabled(tenant)).cleanupTenant({
      tenant,
      ...rest,
    });
  }
  logger.info('Deassign phone numbers and remove provider data for tenant - done');
  notify({
    ctx: { tenantId: admin.id },
    event: eventTypes.REMOVE_TENANT_PLIVO_CLEANUP_DONE,
    data: { tenantId: tenant.id },
  });
  return { processed: true };
};

export const onTenantCommProviderCleanup = async ({ phoneSupportEnabled, endpoints, recordingIds }) => {
  logger.trace('cleanupCommProviderForTenant');
  const ops = await getProviderOps(phoneSupportEnabled);

  try {
    await ops.deleteEndpoints(endpoints);
    await ops.deleteRecordings(recordingIds);
  } catch (e) {
    logger.warn({ e }, 'cleanup comm provider for tenant failed, manual cleanup or full comm provider cleanup may be required');
  }

  return { processed: true };
};

export const onTenantUpdated = async ({ previousTenant, currentTenant }) => {
  logger.debug('onTenantUpdated');
  const previousPhoneNumbers = (previousTenant.metadata && previousTenant.metadata.phoneNumbers) || [];
  const currentPhoneNumbers = (currentTenant.metadata && currentTenant.metadata.phoneNumbers) || [];

  if (isEqual(previousPhoneNumbers, currentPhoneNumbers)) {
    // this can happen on updates other than phone numbers
    return { processed: true };
  }

  const phoneSupportEnabled = isPhoneSupportEnabled(currentTenant);
  const getNo = info => info.phoneNumber;

  const numbersToDeassign = differenceBy(previousPhoneNumbers, currentPhoneNumbers, getNo);
  const numbersToAssign = differenceBy(currentPhoneNumbers, previousPhoneNumbers, getNo);

  const numbersFailedToDeassign = await getProviderOps(phoneSupportEnabled).deassignPhoneNumbers(numbersToDeassign);

  if (numbersFailedToDeassign && numbersFailedToDeassign.length) {
    const phoneNumbersFailedToDeassign = previousPhoneNumbers.filter(p => numbersFailedToDeassign.includes(p.phoneNumber));
    logger.warn({ numbersFailedToDeassign }, 'Failed to deassign!');

    const currentPhoneNumbersWithFailedOnes = currentPhoneNumbers.concat(phoneNumbersFailedToDeassign);
    const updatedTenant = await updateTenantPhoneNumbers({ tenantId: currentTenant.id }, currentTenant, currentPhoneNumbersWithFailedOnes);

    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.PHONENO_ASSIGNATION_FAILURE,
      data: updatedTenant,
    });
    return { processed: true };
  }

  const assignedPhoneNumbers = await getProviderOps(phoneSupportEnabled).assignPhoneNumbers(numbersToAssign, currentTenant);

  if (!isEqual(numbersToAssign, assignedPhoneNumbers)) {
    const numbersFailedToAssign = differenceBy(numbersToAssign, assignedPhoneNumbers, getNo).map(p => p.phoneNumber);
    logger.warn({ numbersFailedToAssign }, 'Failed to assign!');

    const currentPhoneNumbersWithoutFailedOnes = currentPhoneNumbers.filter(p => !numbersFailedToAssign.includes(p.phoneNumber));
    const updatedTenant = await updateTenantPhoneNumbers({ tenantId: currentTenant.id }, currentTenant, currentPhoneNumbersWithoutFailedOnes);

    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.PHONENO_ASSIGNATION_FAILURE,
      data: updatedTenant,
    });

    return { processed: true };
  }

  notify({
    ctx: { tenantId: admin.id },
    event: eventTypes.PHONENO_ASSIGNATION_SUCCESS,
    data: currentTenant,
  });
  logger.debug('onTenantUpdated complete');
  return { processed: true };
};

export const createGuestApplication = async tenant => {
  logger.debug('createGuestApplication');
  try {
    await getProviderOps(isPhoneSupportEnabled(tenant)).createGuestApplication(tenant);
    logger.info('Communication service: guest application was set up successfully');
    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.CREATE_PLIVO_GUEST_APPLICATION_DONE,
      data: { tenantId: tenant.id, successfully: true },
    });
    return { processed: true };
  } catch (error) {
    logger.error({ error }, 'Communication service: creating guest application failed');
    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.CREATE_PLIVO_GUEST_APPLICATION_DONE,
      data: { tenantId: tenant.id, successfully: false },
    });
    return { processed: false };
  }
};

export const onUserRegistered = async ({ ctx, user }) => {
  if (user.sipEndpoints.find(e => e.isUsedInApp)) return { processed: true };
  const tenant = await getTenantData(ctx);
  const updatedUser = await getProviderOps(isPhoneSupportEnabled(tenant)).setupUser({ ctx, user });

  updatedUser &&
    notify({
      ctx,
      event: eventTypes.SIP_UPDATED,
      data: updatedUser,
    });
  return { processed: true };
};

export const onCreateIpPhoneCredentials = async ({ ctx, user }) => {
  try {
    const tenant = await getTenant(ctx);
    const updatedUser = await getProviderOps(isPhoneSupportEnabled(tenant)).createIpPhoneEndpoint({ ctx, user });

    updatedUser &&
      notify({
        ctx,
        event: eventTypes.USERS_UPDATED,
        data: { userIds: [updatedUser.id], teams: updatedUser.teams },
      });
    return { processed: true };
  } catch (error) {
    logger.error({ tenantId: ctx.tenantId, error, user: user.fullName }, 'Failed to create IP Phone credentials for user');
    notify({
      ctx,
      event: eventTypes.CREATE_IP_PHONE_CREDENTIALS_FAILED,
      data: { error },
    });
    return { processed: true };
  }
};

export const onRemoveIpPhoneCredentials = async ({ ctx, user, sipUsername }) => {
  try {
    const tenant = await getTenantData(ctx);
    const updatedUser = await getProviderOps(isPhoneSupportEnabled(tenant)).removeIpPhoneEndpoint({ ctx, user, sipUsername });

    updatedUser &&
      notify({
        ctx,
        event: eventTypes.USERS_UPDATED,
        data: { userIds: [updatedUser.id], teams: updatedUser.teams },
      });
    return { processed: true };
  } catch (error) {
    logger.error({ tenantId: ctx.tenantId, error, user: user.fullName }, 'Failed to remove IP Phone credentials for user');
    notify({
      ctx,
      event: eventTypes.REMOVE_IP_PHONE_CREDENTIALS_FAILED,
      data: { error },
    });
    return { processed: true };
  }
};

export const onCurrentEnvCleanup = async () => {
  try {
    await getProviderOps(true).cleanupForCurrentEnv();
    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.COMM_PROVIDER_CLEANUP_DONE,
      data: {},
    });
  } catch (error) {
    logger.error({ error }, 'Failed while cleaning up com provider for current env');
    notify({
      ctx: { tenantId: admin.id },
      event: eventTypes.COMM_PROVIDER_CLEANUP_DONE,
      data: { error },
    });
  }
  return { processed: true };
};

export const assignPhoneNumber = async (ctx, phoneNumber) => {
  const tenant = await getTenantData(ctx);
  logger.trace({ ctx, phoneNumber }, 'assigning phone number to tenant');
  await getProviderOps(isPhoneSupportEnabled(tenant)).assignPhoneNumbers([{ phoneNumber }], tenant);
};
export const buyPhoneNumber = async (ctx, number) => {
  logger.trace({ ctx, number }, 'buying phone number');
  const tenant = await getTenantData(ctx);
  return await getProviderOps(isPhoneSupportEnabled(tenant)).buyNumber(number);
};

export const searchPhoneNumbers = async (ctx, { countryCode, type, maxResults, pattern, region }) => {
  logger.trace({ ctx, countryCode, type, maxResults, pattern, region }, 'searching phone numbers');
  const tenant = await getTenantData(ctx);
  return await getProviderOps(isPhoneSupportEnabled(tenant)).searchNumbers({ countryCode, type, maxResults, pattern, region });
};
