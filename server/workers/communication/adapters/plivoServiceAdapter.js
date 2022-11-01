/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Promise from 'bluebird';
import newId from 'uuid/v4';
import { Client } from 'plivo';
import pickBy from 'lodash/pickBy';
import config from '../../../config';
import cucumberConfig from '../../../../cucumber/config';
import { toObjectWithProfiledFunctions } from '../../../helpers/profiler';
import logger from '../../../../common/helpers/logger';
import { admin } from '../../../common/schemaConstants';
import { knex } from '../../../database/factory';
import { getTenantData, getTenants, updateTenant } from '../../../dal/tenantsRepo';
import { updateUser, getAllSipEndpoints } from '../../../dal/usersRepo';
import { NON_ALPHANUMERIC_CHARS } from '../../../../common/regex';
import { getTelephonyConfigs } from '../../../helpers/tenantContextConfigs';

const { cucumber } = cucumberConfig;
const { cloudEnv, telephony, isDevelopment, isIntegration } = config;

const client = new Client(telephony.plivoAuth.authId, telephony.plivoAuth.authToken);
const handleNotFound = error => {
  if (error.message && error.message.includes('not found')) return { notFound: true };
  throw error;
};

const getEntities = (getFunc, entitiesName) => async (maxResults = 0) => {
  const getAllRec = async (getChunk, acc) => {
    const objects = await getChunk({ offset: acc.offset, limit: 100 });
    if (!objects.length) {
      logger.error({}, 'could not retrieve results from plivo');
      return [];
    }

    const total = maxResults || objects.meta.totalCount;
    logger.info(`retrieved from plivo: ${entitiesName} ${acc.offset} to ${acc.offset + objects.length} out of ${total}`);

    const newAcc = {
      offset: acc.offset + objects.length,
      objects: [...acc.objects, ...objects],
    };

    if (newAcc.objects.length >= total) return newAcc.objects;
    return getAllRec(getChunk, newAcc);
  };

  const results = await getAllRec(getFunc, { offset: 0, objects: [] });
  return maxResults ? results.slice(0, maxResults) : results;
};

const deleteEntities = (delFunc, type, nameKey, idKey) => entities => {
  const deletePromises = entities.map(async e => {
    logger.info(`deleting ${type} ${e[nameKey]}...`);

    const response = await delFunc(e[idKey]).catch(handleNotFound);

    if (response && response.notFound) logger.info(`${type} ${e[nameKey]} was not found`);
    else logger.info(`${type} ${e[nameKey]} was deleted`);
  });

  return Promise.all(deletePromises);
};

const plivoServiceOps = {
  createSubaccount: ({ name, enabled }) => client.subAccounts.create(name, enabled),
  deleteSubaccount: id => client.subAccounts.delete(id).catch(handleNotFound),
  getAllSubaccounts: getEntities((...args) => client.subAccounts.list(...args), 'subaccounts'),
  deleteSubaccounts: deleteEntities(id => client.subAccounts.delete(id), 'subaccount', 'name', 'authId'),

  createApplication: ({ name, ...params }) => client.applications.create(name, params),
  deleteApplication: id => client.applications.delete(id).catch(handleNotFound),
  getAllApplications: getEntities((...args) => client.applications.list(...args), 'applications'),
  deleteApplications: deleteEntities(id => client.applications.delete(id), 'application', 'appName', 'appId'),

  updatePhoneNumber: ({ number, ...params }) => client.numbers.update(number, params),
  buyNumber: (number, appId) => client.numbers.buy(number, appId),
  getAllNumbers: getEntities((...args) => client.numbers.list(...args), 'numbers'),
  searchNumbers: ({ countryCode, maxResults, ...params }) =>
    getEntities(args => client.numbers.search(countryCode, { ...params, ...args }), 'numbers')(maxResults),

  createEndpoint: ({ username, password, alias, appId }) => client.endpoints.create(username, password, alias, appId),
  deleteEndpoint: id => client.endpoints.delete(id).catch(handleNotFound),
  getAllEndpoints: getEntities((...args) => client.endpoints.list(...args), 'endpoints'),
  deleteEndpoints: deleteEntities(id => client.endpoints.delete(id), 'endpoint', 'username', 'endpointId'),

  deleteRecordings: deleteEntities(id => client.recordings.delete(id), 'recording', 'id', 'id'),
};

let plivoOps = isDevelopment || isIntegration ? toObjectWithProfiledFunctions(plivoServiceOps) : plivoServiceOps;

export const setProviderOps = ops => (plivoOps = ops);

export const envHasHardcodedNumbers = () => cucumber.plivo.some(item => item.cloudEnv === cloudEnv);

const getCucumberEmptyAppId = () => {
  const plivoEnvData = cucumber.plivo;
  const envData = plivoEnvData.find(item => item.cloudEnv === cloudEnv);
  return envData ? telephony[envData.emptyAppId] : telephony.plivoEmptyCucumberAppId;
};

const getEmptyAppId = usedByCucumber => (usedByCucumber ? getCucumberEmptyAppId() : telephony.plivoEmptyAppId);
const isPhoneUsedByCucumber = tenantName => tenantName === cucumber.tenantName;

export const getAvailableNumbers = async usedByCucumber => {
  logger.debug({ usedByCucumber }, 'getAvailableNumbers');
  const numbers = await plivoOps.getAllNumbers();
  const emptyAppId = getEmptyAppId(usedByCucumber);

  const availableNumbers = numbers.filter(o => o.application && o.application.includes(emptyAppId)).map(o => o.number);
  logger.debug({ availableNumbers, emptyAppId }, 'getAvailableNumbers response');
  return availableNumbers;
};

const createUserEndpoint = async (ctx, user) => {
  logger.info(`Creating endpoint for user ${user.fullName}`);
  // comm provider only accepts alphanumeric characters for username
  const MAX_CHARACTERS_ALLOWED_FOR_NAME = 25;
  const MAX_CHARACTERS_ALLOWED_FOR_ALIAS = 50;
  const name = user.fullName.replace(NON_ALPHANUMERIC_CHARS, '');
  const nameForPlivo = name.substring(0, MAX_CHARACTERS_ALLOWED_FOR_NAME);
  const alias = name.substring(0, MAX_CHARACTERS_ALLOWED_FOR_ALIAS);

  const { metadata } = await getTenantData(ctx);

  const params = {
    username: nameForPlivo,
    password: newId(),
    alias,
    appId: metadata ? metadata.plivoAppId : telephony.plivoAppId,
  };

  const response = await plivoOps.createEndpoint(params);

  return {
    username: response.username,
    password: params.password,
    endpointId: response.endpointId,
  };
};

export const setupUser = async ({ ctx, user }) => {
  logger.trace({ ctx, userId: user.id }, 'setupUser');
  const { username, password, endpointId } = await createUserEndpoint(ctx, user);

  const sipEndpoints = [...user.sipEndpoints, { endpointId, username, password, isUsedInApp: true }];

  return updateUser(ctx, user.id, { sipEndpoints });
};

export const createIpPhoneEndpoint = async ({ ctx, user }) => {
  logger.trace({ ctx, userId: user.id }, 'createIpPhoneEndpoint');
  const { username, password, endpointId } = await createUserEndpoint(ctx, user);

  const sipEndpoints = [...user.sipEndpoints, { endpointId, username, password }];

  return await updateUser(ctx, user.id, { sipEndpoints });
};

export const removeIpPhoneEndpoint = async ({ ctx, user, sipUsername }) => {
  logger.trace({ ctx, userId: user.id }, 'removeIpPhoneEndpoint');
  const { endpointId: id } = user.sipEndpoints.find(e => e.username === sipUsername);

  await plivoOps.deleteEndpoint(id);

  const sipEndpoints = user.sipEndpoints.filter(e => e.username !== sipUsername);
  return await updateUser(ctx, user.id, { sipEndpoints });
};

const setEmptyApplicationForNumbers = async (phoneNumbers, tenantName) => {
  const assignationPromises = phoneNumbers.map(async ({ phoneNumber }) => {
    try {
      logger.info(`Assign ${phoneNumber} to empty application`);
      return await plivoOps.updatePhoneNumber({ number: phoneNumber, appId: getEmptyAppId(isPhoneUsedByCucumber(tenantName)), subaccount: '' });
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Failed to assign phone number to empty application');
      return '';
    }
  });
  await Promise.all(assignationPromises);
};

export const removeEntities = async ({ applications, subaccounts, endpoints, affectedNumbers }) => {
  await setEmptyApplicationForNumbers(
    affectedNumbers.map(n => ({ phoneNumber: n.number })),
    '',
  );
  await plivoOps.deleteEndpoints(endpoints);
  await plivoOps.deleteApplications(applications);
  await plivoOps.deleteSubaccounts(subaccounts);
};

export const getEntitiesByPrefix = async (prefix, exceptApps = new Set(), exceptSubs = new Set(), exceptEndpoints = new Set()) => {
  const allApps = (await plivoOps.getAllApplications()).filter(a => a.appName.startsWith(`${prefix}_`));
  const applications = allApps.filter(a => !exceptApps.has(a.appId));

  const numbers = await plivoOps.getAllNumbers();
  const affectedNumbers = numbers.filter(n => applications.find(app => app.resourceUri === n.application));

  const subaccounts = (await plivoOps.getAllSubaccounts()).filter(s => s.name.startsWith(`${prefix}_`) && !exceptSubs.has(s.authId));

  const applicationsUris = new Set(allApps.map(a => a.resourceUri).filter(u => !!u));
  const endpoints = (await plivoOps.getAllEndpoints()).filter(e => applicationsUris.has(e.application)).filter(e => !exceptEndpoints.has(e.username));

  return { applications, subaccounts, endpoints, affectedNumbers };
};

const cleanupPlivoData = async () => {
  const entities = await getEntitiesByPrefix(cloudEnv);
  return removeEntities(entities);
};

export const getAllNumbersAndAssociatedApps = async () => {
  const allApps = await plivoOps.getAllApplications();
  const numbers = await plivoOps.getAllNumbers();

  return numbers.map(n => {
    const app = allApps.find(a => a.resourceUri === n.application) || { appName: '' };
    return { envName: app.appName.substring(0, app.appName.indexOf('_')), number: n.number, app: app.appName };
  });
};

export const searchNumbers = async ({ countryCode = 'US', type = 'local', maxResults = 1, pattern, region } = {}) => {
  const filters = pickBy({ pattern, region }, filter => !!filter);
  const numbers = await plivoOps.searchNumbers({ maxResults, countryCode, type, services: 'voice,sms', ...filters });

  logger.debug({ countryCode, type, maxResults, pattern, region, total: numbers.length, numbers }, 'searchNumbers result');
  return numbers;
};

export const buyNumber = async number => {
  const emptyAppId = getEmptyAppId();
  const result = await plivoOps.buyNumber(number, emptyAppId);
  logger.debug({ number, result }, 'buyNumber result');
  return result;
};

const getHardcodedPhoneNumberForEnv = () => cucumber.plivo.filter(item => item.cloudEnv === cloudEnv).map(item => item.phoneNumber);

export const setupTenant = async tenant => {
  // maximum length accepted by plivo for application and subaccount name is 60
  const name = `${cloudEnv}_${tenant.name}_${tenant.id}`.substr(0, 60);

  // before we create a new app, make sure we  don't have entities (account, subaccounts or endpoints) left from prev runs
  if (envHasHardcodedNumbers()) {
    const envHardcodedNumbers = getHardcodedPhoneNumberForEnv();
    logger.info('Environment hardcoded numbers: ', envHardcodedNumbers);
    await setEmptyApplicationForNumbers(envHardcodedNumbers, tenant.name);
    await cleanupPlivoData();
  }

  const { authId, authToken } = await plivoOps.createSubaccount({ name, enabled: true });
  const adminCtx = { tenantId: admin.id };
  const hostname = tenant.hostname;

  const { answerUrl, messageUrl, hangupUrl } = await getTelephonyConfigs({
    tenant,
    hostname,
  });
  const data = {
    name,
    answerUrl,
    messageUrl,
    hangupUrl,
    subaccount: authId,
  };

  const { appId } = await plivoOps.createApplication(data);

  const plivoProfile = {
    plivoAppId: appId,
    plivoSubaccountAuthId: authId,
    plivoSubaccountAuthToken: authToken,
  };

  const tenantMetadata = {
    ...tenant.metadata,
    ...plivoProfile,
  };

  return updateTenant(adminCtx, tenant.id, { metadata: tenantMetadata });
};

export const deleteEndpoints = endpoints => plivoOps.deleteEndpoints(endpoints);
export const deleteRecordings = ids => plivoOps.deleteRecordings(ids.map(id => ({ id })));

export const cleanupTenant = async ({ tenant, endpoints, recordingIds = [] }) => {
  const tenantPhoneNumbers = (tenant.metadata && tenant.metadata.phoneNumbers) || [];
  await setEmptyApplicationForNumbers(tenantPhoneNumbers, tenant.name);
  await plivoOps.deleteRecordings(recordingIds.map(id => ({ id })));
  await plivoOps.deleteEndpoints(endpoints);
  await plivoOps.deleteApplication(tenant.metadata.plivoAppId);
  await plivoOps.deleteSubaccount(tenant.metadata.plivoSubaccountAuthId);
  if (tenant.metadata.plivoGuestAppId) await plivoOps.deleteApplication(tenant.metadata.plivoGuestAppId);
};

const assignPhoneNumberToPlivoApplication = async (phoneNumber, appId, subaccountId = '') => {
  if (!appId) {
    logger.error({ phoneNumber }, 'Cannot assign phone number to undefined application id');
    return '';
  }

  try {
    await plivoOps.updatePhoneNumber({ number: phoneNumber, appId, subaccount: subaccountId });
  } catch (error) {
    logger.error({ error, phoneNumber }, 'Failed to assign phone number');
    return '';
  }

  return phoneNumber;
};

export const deassignPhoneNumbers = async numbersToDeassign => {
  logger.debug({ numbersToDeassign }, 'deassignPhoneNumbers');
  const deassignationPromises = numbersToDeassign.map(async info => {
    try {
      await plivoOps.updatePhoneNumber({ number: info.phoneNumber, appId: telephony.plivoEmptyAppId, subaccount: '' });
      return { success: true };
    } catch (error) {
      logger.error({ error, phoneNumber: info.phoneNumber }, 'Failed to deassign phone number');
      return { success: false, phoneNumber: info.phoneNumber };
    }
  });

  return (await Promise.all(deassignationPromises)).filter(res => !res.success).map(res => res.phoneNumber);
};

export const assignPhoneNumbers = async (numbersToAssign, currentTenant) => {
  logger.debug({ numbersToAssign }, 'assignPhoneNumbers');

  const { plivoAppId, plivoSubaccountAuthId } = currentTenant.metadata;
  const assignationPromises = numbersToAssign.map(async ({ phoneNumber, ...rest }) => {
    const assignedPhoneNumber = await assignPhoneNumberToPlivoApplication(phoneNumber, plivoAppId, plivoSubaccountAuthId);
    return { phoneNumber: assignedPhoneNumber, ...rest };
  });

  return (await Promise.all(assignationPromises)).filter(e => !!e.phoneNumber);
};

export const cleanupForCurrentEnv = async () => {
  const adminCtx = { tenantId: admin.id };
  const tenants = await getTenants(knex, adminCtx);

  const tenantsApps = new Set(tenants.map(t => t.metadata && t.metadata.plivoAppId).filter(id => !!id));

  const tenantsSubaccounts = new Set(tenants.map(t => t.metadata && t.metadata.plivoSubaccountAuthId).filter(id => !!id));

  const tenantsEndpoints = new Set(
    (await Promise.reduce(tenants, async (endpoints, tenant) => [...endpoints, ...(await getAllSipEndpoints({ tenantId: tenant.id }))], [])).map(
      e => e.username,
    ),
  );

  const entities = await getEntitiesByPrefix(cloudEnv, tenantsApps, tenantsSubaccounts, tenantsEndpoints);
  return removeEntities(entities);
};

export const createGuestApplication = async ({ id, hostname }) => {
  // maximum length accepted by plivo for application and subaccount name is 60
  const name = `${cloudEnv}_guest_application_${id}`.substr(0, 60);

  const adminCtx = { tenantId: admin.id };

  const tenant = await getTenantData(adminCtx, id);
  const { guestMessageUrl } = await getTelephonyConfigs({ tenant, hostname });
  const { appId } = await plivoOps.createApplication({ name, messageUrl: guestMessageUrl });
  const numbers = await getAvailableNumbers(true);

  const assignedPhoneNumber = await assignPhoneNumberToPlivoApplication(numbers[numbers.length - 1], appId);

  const phoneNumbers = [
    ...tenant.metadata.phoneNumbers,
    {
      phoneNumber: assignedPhoneNumber,
    },
  ];

  const tenantMetadata = {
    ...tenant.metadata,
    phoneNumbers,
    plivoGuestAppId: appId,
    plivoGuestPhoneNumber: assignedPhoneNumber,
  };

  await updateTenant(adminCtx, tenant.id, { metadata: tenantMetadata });
};
