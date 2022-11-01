/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import superagent from 'superagent';
import getAuthHeader from './authentication';
import config from '../../config';
import logger from '../../../common/helpers/logger';
import { tenantAdminEmail } from '../../../common/helpers/database';

const { cucumber, apiToken } = config;
const adminUrl = `https://${cucumber.adminTenantName}.${cucumber.domain}`;

let authToken;
// TODO This is not ok to be here. We should have a separate admin users when running the tests
// the problem is that the cucumber run script uses the same create_admin as the prod...
const adminCredentials = {
  email: tenantAdminEmail,
  password: 'R#va@SFO&SJO&CLJ',
};

export const setAuthToken = token => {
  authToken = token;
};

function makePromise(request) {
  return new Promise((resolve, reject) => {
    request.end((err, res) => {
      if (err) {
        logger.error({ error: { message: err?.message, stack: err?.stack } }, 'makePromise error');
        reject(err);
        return;
      }
      resolve(res.body);
    });
  });
}

function doRequest({ method, url, data, auth }) {
  let request = superagent[method](url);

  request = request.use(req => {
    logger.trace({ sreq: { url: req.url }, data }, 'superagent request');

    const callback = req.callback;

    req.callback = (err, response) => {
      const res = response || {};

      const saRes = { url: req.url, sres: { headers: res.headers, statusCode: res.statusCode, body: res.text } };
      if (err) {
        const args = { error: err };

        if (res) {
          args.sres = { headers: res.headers, statusCode: res.statusCode, body: res.text };
        }

        logger.error(args, 'superagent error');
        return callback.call(req, err, res);
      }

      if (res.statusCode >= 400) {
        logger.error(saRes, 'superagent error response');
      } else {
        logger.trace(saRes, 'superagent response');
      }

      if (!callback) {
        return; // eslint-disable-line
      }
      return callback.call(req, err, res);
    };
  });

  if (data) {
    request = request.send(data);
  }

  request = request.set(authToken ? { Authorization: `Bearer ${authToken}` } : getAuthHeader(auth));
  return makePromise(request);
}

export const loginAdminUser = () => {
  console.log('logging in as admin');
  return doRequest({
    method: 'post',
    url: `${adminUrl}/api/login`,
    data: adminCredentials,
    auth: 'admin',
  });
};

export function createTenant(testTenant) {
  return doRequest({
    method: 'post',
    url: `${adminUrl}/api/tenants`,
    data: testTenant,
    auth: testTenant,
  });
}

export function deleteTenant(testTenant) {
  return doRequest({
    method: 'delete',
    url: `${adminUrl}/api/tenants/${testTenant.id}`,
    auth: testTenant,
  });
}

export function refreshTenant(testTenant, testId = '') {
  return doRequest({
    method: 'post',
    url: `${adminUrl}/api/tenants/${testTenant.id}/refreshTenantSchema?importInventory=true&testId=${testId}`,
    auth: testTenant,
  });
}

export function patchTenant(testTenant) {
  return doRequest({
    method: 'patch',
    url: `${adminUrl}/api/tenants/${testTenant.id}`,
    data: { metadata: testTenant.metadata },
    auth: testTenant,
  });
}

export function getAllTenants(testTenant) {
  return doRequest({
    url: `${adminUrl}/api/tenants`,
    method: 'get',
    auth: testTenant,
  });
}

export function sendRegistrationInvite(invite) {
  return doRequest({
    url: `${adminUrl}/api/sendInvite`,
    method: 'post',
    data: invite,
    auth: 'admin',
  });
}

export function updateRegistrationInvite(inviteData) {
  return doRequest({
    method: 'patch',
    url: `${adminUrl}/api/test/updateInvite?apiToken=${apiToken}`,
    data: inviteData,
    auth: 'admin',
  });
}

export function clearRabbitMqQueues() {
  return doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/clearQueues?apiToken=${apiToken}`,
    auth: 'admin',
  });
}

export function stopAllRecurringJobs() {
  return doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/disableRecurringJobs?apiToken=${apiToken}`,
    auth: 'admin',
  });
}

export function startAllRecurringJobs() {
  return doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/enableRecurringJobs?apiToken=${apiToken}`,
    auth: 'admin',
  });
}

export const getAvailableCucumberPhoneNumber = phoneSupportEnabled =>
  doRequest({
    method: 'get',
    url: `${adminUrl}/api/test/availableCucumberPhoneNumber?apiToken=${apiToken}`,
    data: { phoneSupportEnabled },
    auth: 'admin',
  });

export const getProgramByEmailIdentifier = ({ tenantId, directEmailIdentifier }) =>
  doRequest({
    method: 'get',
    url: `${adminUrl}/api/test/program?apiToken=${apiToken}`,
    data: { tenantId, directEmailIdentifier },
    auth: 'admin',
  });

export const sendGuestSMS = payload =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/sendGuestSMS?apiToken=${apiToken}`,
    data: payload,
    auth: 'admin',
  });

export const sendGuestEmail = payload =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/sendGuestEmail?apiToken=${apiToken}`,
    data: payload,
    auth: 'admin',
  });

export const replyToEmailWith = payload =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/replyToEmailWith?apiToken=${apiToken}`,
    data: payload,
    auth: 'admin',
  });

export const verifyEmailIsDelivered = payload =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/verifyEmailIsDeliveredToGuest?apiToken=${apiToken}`,
    data: payload,
    auth: 'admin',
  });

export const verifyGuestReceivedMessageFromNumber = payload =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/verifyGuestReceivedMessageFromNumber?apiToken=${apiToken}`,
    data: payload,
    auth: 'admin',
  });

export const deleteMessagesFromNumber = payload =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/deleteMessagesFromNumber?apiToken=${apiToken}`,
    data: payload,
    auth: 'admin',
  });

export const createGuestApplication = data =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/createGuestApplication?apiToken=${apiToken}`,
    data,
    auth: 'admin',
  });

export const forceUsersLogout = data =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/tenant/forceLogout?apiToken=${apiToken}`,
    data,
    auth: 'admin',
  });

/**
 * Create the truncate function used to remove data from all tables
 */
export const createTruncanteFn = () =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/createTruncateFn?apiToken=${apiToken}`,
    auth: 'admin',
  });

/**
 * Remove all data from the tables of the provided schemas.
 * This is needed to perform a clean restore without worrying about the constraints
 * @param {Object} data
 * @param {Array} data.schemas the schemas from where all the data will be truncated
 */
export const truncateTablesOnTenants = data =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/schema/truncate?apiToken=${apiToken}`,
    data,
    auth: 'admin',
  });

export const getTeams = testTenant =>
  doRequest({
    method: 'get',
    url: `${adminUrl}/api/tenants/${testTenant.id}/teams`,
    auth: testTenant,
  });

export const getCommunicationsForParty = data =>
  doRequest({
    method: 'get',
    url: `${adminUrl}/api/test/communications?apiToken=${apiToken}`,
    data,
    auth: 'admin',
  });

export const getPropertyByName = async (testTenant, propertyName) =>
  await doRequest({
    method: 'get',
    url: `${adminUrl}/api/test/tenants/${testTenant.id}/property/${propertyName}`,
    auth: testTenant,
  });

export const saveUnitsPricingByPropertyId = async (testTenant, propertyId, data) =>
  await doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/tenants/${testTenant.id}/unitsPricing/${propertyId}`,
    auth: testTenant,
    data,
  });

export const updateFeePricingByPropertyId = async (testTenant, propertyId, inventoryFeeNameToUpdatePrice, feePricing) =>
  await doRequest({
    method: 'patch',
    url: `${adminUrl}/api/test/tenants/${testTenant.id}/feePricing/${propertyId}`,
    auth: testTenant,
    data: { feeDisplayName: inventoryFeeNameToUpdatePrice, absolutePrice: feePricing },
  });

export const getProgramByName = async (testTenant, programName) =>
  await doRequest({
    method: 'get',
    url: `${adminUrl}/api/test/tenants/${testTenant.id}/program/${programName}`,
    auth: testTenant,
  });

export const disableAutomaticLogout = testTenant =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/tenant/disableAutomaticLogout?apiToken=${apiToken}`,
    data: { tenantId: testTenant.id },
    auth: testTenant,
  });

export const createAnAppointmentForParty = async ({ tenantId, salesPersonId, partyId, tourType, loadActivePartyMembers }) =>
  doRequest({
    method: 'post',
    url: `${adminUrl}/api/test/appointment?apiToken=${apiToken}`,
    data: { tenantId, salesPersonId, partyId, tourType, loadActivePartyMembers },
    auth: 'admin',
  });
