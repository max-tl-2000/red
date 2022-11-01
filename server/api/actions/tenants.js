/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  saveTenant,
  updateTenant,
  getTenants,
  getTenant,
  deleteTenant,
  setPasswordForType,
  refreshRingCentralToken as refreshRCTokenService,
  requestRingCentralToken as requestRCTokenService,
  getRingCentralAuthUrl as getRCAuthUrl,
  renewRingCentralSubscription as renewRCSubscription,
  generateTokenForDomain,
} from '../../services/tenantService';
import { getTenantReservedPhoneNumbers } from '../../dal/tenantsRepo';
import { getInPrograms, getProgramByName as getProgramByNameRepo } from '../../dal/programsRepo';
import { deassignPhoneNumbers as deassignNumbers } from '../../workers/communication/commProviderIntegration';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE, SYNC_MESSAGE_TYPE, COMM_MESSAGE_TYPE, IMPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { ServiceError } from '../../common/errors';
import config from '../../config';
import * as validators from '../helpers/validators';
import { admin } from '../../common/schemaConstants';
import loggerModule from '../../../common/helpers/logger';
import { getS3Provider } from '../../workers/upload/s3Provider';
import { getTeamsFromTenant } from '../../dal/teamsRepo';
import { maxUnixTenantName } from '../../../common/helpers/utils';
import { getPropertyByName as getPropertyByNameRepo } from '../../dal/propertyRepo';
import { saveUnitsPricingUsingPropertyId } from '../../dal/rmsPricingRepo';

const { apiToken } = config;
const logger = loggerModule.child({ subType: 'tenantsAPI' });

export const createTenant = req => {
  if (req.body.name.length > maxUnixTenantName) {
    throw new ServiceError({
      token: 'TENANT_NAME_TOO_LONG',
      status: 412,
    });
  }

  return saveTenant(req, req.body);
};

export const patchTenant = req => updateTenant(req.params.id, req.body);

export const passwordForType = req => setPasswordForType(req, req.params.id, req.body);

export const clearTenantSchema = async req => {
  const tenantId = req.params.id;
  const tenant = await getTenant({ tenantId: admin.id }, tenantId);
  if (!tenant) {
    throw new ServiceError({ token: 'TENANT_NOT_FOUND', status: 404 });
  }

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SYNC_MESSAGE_TYPE.TENANT_CLEAR_SCHEMA,
    message: {
      ctx: {
        tenantId: req.tenantId,
        tenantName: tenant.name,
        host: req.host,
        protocol: req.protocol,
      },
      tenantIdToClear: tenantId,
    },
    ctx: req,
  });
};

export const refreshTenantSchema = async req => {
  const tenantId = req.params.id;
  // TODO: if possible, query params should be moved to the request body.
  // The query values are always strings, and need to be converted)
  const importInventory = req.query.importInventory === 'true';
  const bigDataCount = req.query.bigDataCount ? parseInt(req.query.bigDataCount, 10) : 0;
  const noOfTeams = req.query.noOfTeams ? parseInt(req.query.noOfTeams, 10) : 0;
  const tenant = await getTenant(req, tenantId);
  const { testId } = req.query;

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SYNC_MESSAGE_TYPE.TENANT_REFRESH_SCHEMA,
    message: {
      ctx: {
        tenantId: req.tenantId,
        tenantName: tenant.name,
        host: req.hostname,
        protocol: req.protocol,
      },
      testId,
      tenantIdToRefresh: tenantId,
      importInventory,
      bigDataCount,
      noOfTeams,
    },
    ctx: req,
  });
};

export const getAllTenants = async req => {
  logger.trace({ ctx: req }, 'getAllTenants');
  return await getTenants();
};

export const deleteTenantById = req => deleteTenant(req, req.params.id);

export const getAvailableTenantPhoneNumbers = async req => {
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SYNC_MESSAGE_TYPE.TENANT_GET_AVAILABLE_PHONE_NUMBERS,
    message: {
      ctx: {
        tenantId: admin.id,
        host: req.hostname,
        protocol: req.protocol,
      },
    },
    ctx: req,
  });
};

export const triggerCommunicationProviderCleanup = async req =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.COMM_PROVIDER_CLEANUP,
    message: {},
    ctx: req,
  });

export const deassignPhoneNumbers = req => {
  const phoneNumbers = req.body;
  const reqApiToken = req.query.apiToken;

  if (!reqApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_REQUIRED',
      status: 403,
    });
  }

  if (reqApiToken !== apiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_INVALID',
      status: 403,
    });
  }

  if (!phoneNumbers) {
    throw new ServiceError({
      token: 'MISSING_PHONE_NUMBERS',
      status: 400,
    });
  }

  return deassignNumbers(phoneNumbers);
};

export const getTenantById = async req => {
  const tenantId = req.params.id;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');
  return getTenant(req, tenantId);
};

export const getTenantTeams = async req => {
  const tenantId = req.params.id;
  validators.uuid(tenantId, 'INVALID_TENANT_ID');
  const teams = await getTeamsFromTenant(tenantId, false);
  const tenantPhoneNumbers = await getTenantReservedPhoneNumbers({ tenantId });
  return { teams, tenantPhoneNumbers };
};

export const getTenantPrograms = async req => {
  const tenantId = req.params.id;
  validators.uuid(tenantId, 'INVALID_TENANT_ID');
  const programs = await getInPrograms(req);
  return { programs };
};

export const refreshLeaseTemplates = async req => {
  const tenantId = req.params.tenantId;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: IMPORT_MESSAGE_TYPE.IMPORT_LEASE_TEMPLATES,
    message: { tenantId },
    ctx: req,
  });
};

export const refreshRingCentralToken = async req => {
  const tenantId = req.params.tenantId;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');
  try {
    await refreshRCTokenService({ ctx: req });
  } catch (e) {
    logger.error({ e }, `Error refreshing token for tenant ${tenantId}`);
    throw new ServiceError({ token: 'RC_TOKEN_REFRESH_FAILED' });
  }
};

export const requestRingCentralToken = async req => {
  const { tenantId } = req.params;
  const { code } = req.body;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');
  try {
    await requestRCTokenService({ ctx: req, code });
  } catch (e) {
    logger.error({ e }, `Error retrieving token for tenant ${tenantId}`);
    throw new ServiceError({ token: 'RC_TOKEN_REQUEST_FAILED' });
  }
  try {
    await renewRCSubscription({ ctx: req });
  } catch (e) {
    logger.error({ e }, 'Error renewing subscription after token request');
    throw new ServiceError({ token: 'RC_RENEW_SUBSCRIPTION_FAILED' });
  }
};

export const getRingCentralAuthUrl = async req => {
  const tenantId = req.params.tenantId;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');

  return await getRCAuthUrl(req, tenantId);
};

export const renewRingCentralSubscription = async req => {
  const tenantId = req.params.tenantId;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');
  try {
    await renewRCSubscription({ ctx: req });
  } catch (e) {
    logger.error({ e }, 'Error renewing subscription after token request');
    throw new ServiceError({ token: 'RC_RENEW_SUBSCRIPTION_FAILED' });
  }
};

export const generateDomainToken = async req => {
  const { tenantId } = req.params;
  logger.trace({ tenantId, body: req.body }, 'generateDomainToken');

  const tenant = await getTenant({ tenantId: admin.id }, tenantId);
  if (!tenant) {
    throw new ServiceError({ token: 'TENANT_NOT_FOUND', status: 400 });
  }

  const token = await generateTokenForDomain({ tenantId, ...req.body });
  return { token };
};

export const downloadExportedDatabaseFileFromS3 = async req => {
  const { tenantId, fileName } = req.params;
  validators.uuid(tenantId, 'INVALID_TENANT_ID');

  const stream = getS3Provider().downloadExportedDatabase(req, fileName);
  return {
    type: 'stream',
    filename: fileName,
    stream,
  };
};

export const getPropertyByName = async req => {
  const { tenantId, propertyName } = req.params;
  const ctx = { tenantId };

  return await getPropertyByNameRepo(ctx, propertyName);
};

export const saveUnitsPricingByPropertyId = async req => {
  const { tenantId, propertyId } = req.params;
  const ctx = { tenantId };

  return await saveUnitsPricingUsingPropertyId(ctx, { ...req.body, propertyId });
};

export const getProgramByName = async req => {
  const { tenantId, programName } = req.params;
  const ctx = { tenantId };

  return await getProgramByNameRepo(ctx, programName);
};
