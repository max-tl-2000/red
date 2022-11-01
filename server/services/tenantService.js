/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import omit from 'lodash/omit'; // eslint-disable-line red/no-lodash
import get from 'lodash/get';
import { createCipher } from 'crypto';
import { sendMessage } from './pubsub';
import { APP_EXCHANGE, SYNC_MESSAGE_TYPE } from '../helpers/message-constants';
import { ServiceError } from '../common/errors';
import { admin } from '../common/schemaConstants';
import {
  saveTenant as saveTenantInDB,
  updateTenant as updateTenantInDb,
  getTenants as getTenantsFromDB,
  deleteTenant as deleteTenantInDB,
  getTenantByName as getTenantByNameRepo,
  getTenantData,
  saveTenantMetadata,
  truncateTablesSqlFn,
} from '../dal/tenantsRepo';
import { now } from '../../common/helpers/moment-utils';
import { saveToken } from '../dal/tokensRepo';
import { updateUser, getAdminUser, getAllSipEndpoints, getRevaAdmin } from '../dal/usersRepo';
import { getAllVoiceRecordingIds as getVoiceRecordingIdsForTenant } from '../dal/communicationRepo';
import { knex, runInTransaction } from '../database/factory';
import { isValidPhoneNumber, formatPhoneNumberForDb } from '../helpers/phoneUtils';
import { isReservedTenantName, isValidTenantName } from '../helpers/tenantUtils';
import { hash } from '../helpers/crypto';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { getTenantHostnameFromContext } from '../helpers/tenantContextConfigs';
import { integratePartyCreatePartyMemberSubscription, refreshSubscriptions } from '../dal/subscriptionsRepo';
import config from '../config';
import {
  refreshToken as rcRefreshToken,
  requestToken as rcRequestToken,
  getAuthUrl as rcGetAuthUrl,
  renewSubscription as rcRenewSubscription,
} from '../workers/communication/adapters/ringCentralServiceAdapter';
import { createJWTToken } from '../../common/server/jwt-helpers';
import loggerModule from '../../common/helpers/logger';
import { ResetPasswordTypes } from '../../common/enums/enums';
import { validateEnum } from '../api/helpers/validators';
import { bulkRemoveEventsAllUsers } from './externalCalendars/cronofyService';
import { ScreeningVersion } from '../../common/enums/screeningReportTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import { generateRevaPricing } from '../workers/rms/rmsHandler';
import { disableRecurringJobByName } from '../dal/jobsRepo';

const logger = loggerModule.child({ subType: 'services/tenantService' });

export const truncateTablesOnSchemas = async (tenant, schemas = []) => {
  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i];
    await knex.raw('select admin.truncate_tables(:schema)', { schema });
  }
};

export const createTruncateFunction = async () => {
  await knex.raw(
    truncateTablesSqlFn({
      excludeKnexMigrations: false,
      excludeCommonProgramSources: false,
      excludeRecurringJobs: false,
      excludeAppSettings: false,
      excludeSubscriptions: false,
    }),
  );
};

export const disableAutomaticLogoutRecurringJob = async ctx => {
  const { Jobs } = DALTypes;

  return await disableRecurringJobByName(ctx, Jobs.MarkEveryoneUnavailable);
};

const setPasswordForAdminUser = async (tenantId, password) => {
  const adminUser = await getAdminUser({ tenantId });
  const hashPassword = await hash(password);
  return updateUser({ tenantId }, adminUser.id, {
    password: hashPassword,
    loginAttempts: 0,
  });
};

const setPasswordForRevaAdmin = async (tenantId, password) => {
  const hashPassword = await hash(password);
  const { id } = await getRevaAdmin({ tenantId });
  return updateUser({ tenantId }, id, { password: hashPassword });
};

export const encryptSftpPassword = password => {
  const cipher = createCipher('aes-256-ctr', config.import.sftp.cipherKey);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted;
};

const createSftpSection = (conn, ctx, tenant) => {
  const encrypted = encryptSftpPassword(config.import.sftp.defaultPassword);

  return {
    id: tenant.id,
    name: `sftp-${tenant.name}`,
    password: encrypted,
    accounts: [
      {
        tenantId: tenant.id,
        name: `sftp-${tenant.name}`,
        password: encrypted,
        home: '/yardi',
        folders: [
          {
            subfolder: '/inbound',
            watch: true,
            name: 'ImportUpdateDataFiles',
          },
          {
            subfolder: '/outbound',
          },
        ],
      },
      {
        tenantId: tenant.id,
        name: `sftp-${tenant.name}-lro`,
        password: encryptSftpPassword(config.import.sftp.defaultLROPassword),
        home: '/rms/lro',
        folders: [
          {
            subfolder: '',
            watch: true,
            name: 'ImportRmsFiles',
          },
        ],
      },
    ],
  };
};

const validatePassword = password => {
  if (!password.trim()) {
    // TODO: improve password validator
    throw new ServiceError({
      token: 'INVALID_PASSWORD',
      status: 400,
    });
  }
};

export const getTenant = async (ctx, tenantId) => {
  const id = tenantId ?? ctx.tenantId;
  return await getTenantData(ctx, id);
};

export const getTenantSettings = async (ctx, tenantId) => {
  const id = tenantId ?? ctx.tenantId;

  if (ctx.tenantName === admin.name) return {};

  const { settings = {} } = (await getTenant(ctx, id)) || {};
  return settings;
};

export const getTenantByName = async tenantName => await getTenantByNameRepo({ tenantId: admin.id }, tenantName);

// TODO: CPM-12483 this will be changed later to default to V2 once the feature is complete
export const getTenantScreeningVersion = async (ctx, tenantId) => {
  const tenant = (tenantId && (await getTenant(ctx, tenantId))) || {};
  return get(tenant, 'metadata.screeningVersion', ScreeningVersion.V1);
};

export const createTenant = async (conn, ctx, tenant) => {
  const metadata = tenant.metadata || {
    enablePhoneSupport: false,
    phoneNumbers: [],
  };

  metadata.screeningVersion = await getTenantScreeningVersion(ctx);
  metadata.sftp = createSftpSection(conn, ctx, tenant);
  metadata.userDefaultPassword = await hash(config.import.users.defaultPassword);
  metadata.duplicateDetectionEnabled = true;
  metadata.sendGridSandboxEnabled = false;
  metadata.isDemoMode = tenant.name.startsWith('demo');

  const savedTenant = await saveTenantInDB(conn, ctx, {
    ...omit(tenant, ['adminPassword']),
    metadata,
  });

  if (tenant.adminPassword) {
    await setPasswordForAdminUser(savedTenant.id, tenant.adminPassword);
  }
  return savedTenant;
};

export const notifyTenantCreated = async (ctx, tenant) => {
  const tenantHostname = getTenantHostnameFromContext(ctx, tenant.name);
  const tenantCtx = { ...tenant, hostname: tenantHostname };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SYNC_MESSAGE_TYPE.TENANT_CREATED,
    message: tenantCtx,
    ctx,
  });
};

const isTenantNameValid = name => {
  if (!name) return;

  if (isReservedTenantName(name)) {
    throw new ServiceError({
      token: 'RESERVED_TENANT_NAME',
      status: 400,
    });
  }

  if (!isValidTenantName(name)) {
    throw new ServiceError({
      token: 'INVALID_TENANT_NAME',
      status: 400,
    });
  }
};

const validatePhoneNumber = number => {
  if (isValidPhoneNumber(number)) return;
  throw new ServiceError({
    token: 'INVALID_PHONE_NUMBER',
    status: 400,
  });
};

const formatTenantProps = tenant => {
  const name = tenant.name && tenant.name.trim();
  isTenantNameValid(name);

  const trimmedNumbers = ((tenant.metadata && tenant.metadata.phoneNumbers) || []).map(e => ({ ...e, phoneNumber: e.phoneNumber.trim() }));
  trimmedNumbers.map(e => e.phoneNumber).forEach(validatePhoneNumber);

  const phoneNumbers = trimmedNumbers.map(e => ({
    ...e,
    phoneNumber: formatPhoneNumberForDb(e.phoneNumber),
  }));

  return {
    ...tenant,
    ...({}.hasOwnProperty.call(tenant, 'name') ? { name } : {}),
    metadata: {
      ...tenant.metadata,
      ...(tenant.metadata && {}.hasOwnProperty.call(tenant.metadata, 'phoneNumbers') ? { phoneNumbers } : {}),
    },
  };
};

export const saveTenant = async (ctx, tenant) => {
  const id = tenant.id || newId();
  const createdTenant = await createTenant(knex, ctx, {
    ...formatTenantProps(tenant),
    id,
  });

  await refreshSubscriptions({ tenantId: createdTenant.id });
  await notifyTenantCreated(ctx, createdTenant);

  return createdTenant;
};

export const updateTenant = async (id, delta) => {
  const previousTenant = await getTenantData({ tenantId: admin.id }, id);
  if (!previousTenant) {
    throw new ServiceError({ token: 'TENANT_NOT_FOUND', status: 404 });
  }

  const formattedDelta = formatTenantProps(delta);
  const mergedMetadataDelta = {
    ...formattedDelta,
    metadata: {
      ...previousTenant.metadata,
      ...formattedDelta.metadata,
    },
  };

  return await runInTransaction(async trx => {
    const currentTenant = await updateTenantInDb({ tenantId: admin.id, trx }, id, mergedMetadataDelta);
    await sendMessage({
      exchange: APP_EXCHANGE,
      key: SYNC_MESSAGE_TYPE.TENANT_UPDATED,
      message: { previousTenant, currentTenant, _noLog: true },
      ctx: { tenantId: id, trx },
    });

    await integratePartyCreatePartyMemberSubscription(knex, { tenantId: id, trx }, currentTenant);

    const { revaPricingAsRms } = delta?.metadata || {};
    const { revaPricingAsRms: previousRevaPricingAsRms } = previousTenant?.metadata || {};

    const shouldGenerateRevaPricing = () => {
      if (typeof revaPricingAsRms !== 'boolean') return false;

      if (revaPricingAsRms && revaPricingAsRms !== previousRevaPricingAsRms) return true;

      if (!revaPricingAsRms && previousRevaPricingAsRms) return true;

      return false;
    };

    if (shouldGenerateRevaPricing()) await generateRevaPricing({ tenantId: id, trx }, revaPricingAsRms);

    return currentTenant;
  });
};

export const getTenants = async () => {
  const res = await getTenantsFromDB(knex, { tenantId: admin.id });
  return { tenants: res.concat([admin]) };
};

export const setPaswordForTenant = async (tenantId, password) => {
  const hashPassword = await hash(password);
  return updateTenant(tenantId, { metadata: { userDefaultPassword: hashPassword } });
};

const setPasswordForSftpOrLro = async (ctx, tenantId, password, account) => {
  const tenant = await getTenantData(ctx, tenantId);
  const { sftp } = tenant.metadata;

  const sftpAccount = sftp.accounts.find(a => a.name === account);
  if (!sftpAccount) {
    throw new ServiceError({ token: 'SFTP_ACCOUNT_NOT_FOUND', status: 400 });
  }

  const encrypted = encryptSftpPassword(password);
  sftpAccount.password = encrypted;
  await saveTenantMetadata(ctx, tenantId, {
    ...tenant.metadata,
    sftp,
  });
};

export const setPasswordForType = async (ctx, selectedTenantId, body) => {
  const { password, type, account } = body;
  validateEnum(ResetPasswordTypes, type, 'VALUE_NOT_PART_OF_THE_ENUM');
  validatePassword(password);
  const tenant = await getTenantData(ctx, selectedTenantId);
  if (!tenant) {
    throw new ServiceError({ token: 'TENANT_NOT_FOUND', status: 404 });
  }

  let successfully;
  try {
    switch (type) {
      case ResetPasswordTypes.ADMIN:
        await setPasswordForAdminUser(selectedTenantId, password);
        break;
      case ResetPasswordTypes.SFTP:
      case ResetPasswordTypes.LRO:
        await setPasswordForSftpOrLro(ctx, selectedTenantId, password, account);
        break;
      case ResetPasswordTypes.USER_DEFAULT:
        await setPaswordForTenant(selectedTenantId, password);
        break;
      case ResetPasswordTypes.REVA_ADMIN:
        await setPasswordForRevaAdmin(selectedTenantId, password);
        break;
      default:
    }
    successfully = true;
  } catch (error) {
    logger.error({ ctx, selectedTenantId, error }, `Error saving ${type} password for ${selectedTenantId}`);
    throw new ServiceError({
      token: 'ERROR_UPDATING_USER',
      status: 400,
    });
  } finally {
    notify({
      ctx,
      event: eventTypes.UPDATE_TYPES_PASSWORD,
      data: { tenantName: tenant.name, successfully, type },
    });
  }
};

export const deleteTenant = async (req, tenantId, getRecordingFunc) => {
  logger.trace({ ctx: req, tenantId }, 'deleteTenant');

  const tenant = await getTenantData(req, tenantId);
  await bulkRemoveEventsAllUsers({ tenantId });
  const recordingIds = (getRecordingFunc && getRecordingFunc()) || (await getVoiceRecordingIdsForTenant({ tenantId }));
  const endpoints = await getAllSipEndpoints({ tenantId });
  const res = await deleteTenantInDB(req, tenantId);
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SYNC_MESSAGE_TYPE.TENANT_REMOVED,
    message: { tenant, endpoints, recordingIds },
    ctx: req,
  });

  return res;
};

export const getTenantPhoneNumber = async tenantName => {
  const ctx = { tenantId: admin.id };
  const { metadata } = await getTenantByNameRepo(ctx, tenantName);

  // TODO Change this after specs are defined for tenant phone number (CPM-2538)
  if (metadata && metadata.phoneNumbers && metadata.phoneNumbers.length) {
    return metadata.phoneNumbers[0].phoneNumber;
  }
  return '';
};

export const refreshRingCentralToken = async ({ ctx }) => {
  const tenant = await getTenant(ctx);
  await rcRefreshToken({ ctx, tenant });
};

export const requestRingCentralToken = async ({ ctx, code }) => rcRequestToken({ ctx, code });

export const renewRingCentralSubscription = async ({ ctx }) => {
  const tenant = await getTenant(ctx);
  await rcRenewSubscription({ ctx, tenant });
};

export const getRingCentralAuthUrl = async ctx => rcGetAuthUrl({ ctx });

export const generateTokenForDomain = async ({ tenantId, tokenId = newId(), domain, allowedEndpoints, expiresIn, validateReferrer }) => {
  if (!domain) {
    throw new ServiceError({
      token: 'MISSING_DOMAIN',
      status: 400,
    });
  }

  const endpoints = allowedEndpoints || ['contactUs'];
  const token = createJWTToken({ tokenId, allowedReferrer: validateReferrer ? domain : '', endpoints, tenantId }, { expiresIn: expiresIn || '1y' });

  const validFor = parseInt(expiresIn, 10);
  await saveToken(
    { tenantId },
    {
      token: tokenId,
      expiry_date: now().add(validFor, 'year'),
      type: DALTypes.TokenType.DOMAIN,
      metadata: { domain, endpoints },
    },
  );

  return token;
};
