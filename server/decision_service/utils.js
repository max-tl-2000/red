/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import v4 from 'uuid/v4';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import logger from '../../common/helpers/logger';
import { X_REQUEST_ID, X_ORIGINAL_REQUEST_IDS, X_DOCUMENT_VERSION, formatArrayHeaderValues } from '../../common/enums/requestHeaders';
import config from './config';

const { publicLeasingAPIUrl: externalAPIPath } = config;

export const partyScoreIntegrationEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/score`;

export const tasksIntegrationEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/tasks`;

export const partyEmailIntegrationEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/email`;
export const partyScreeningReportsEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/screeningReports`;
export const customMessagesEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/delayedMessages`;

export const integrationEndpoint = (callBackUrl, partyId, path) => `${callBackUrl || externalAPIPath}${path.replace('PARTY_ID', partyId)}`;

export const partyCreatePartyMemberEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/partyMember`;

export const partyReassignEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/reassignParty`;

export const archivePartyEndpoint = (callBackUrl, partyId) => `${callBackUrl || externalAPIPath}/party/${partyId}/archiveParty`;

let _leasingApiRequest = () => request;
const leasingApiRequest = () => _leasingApiRequest();
export const setLeasingApiRequest = requestor => {
  _leasingApiRequest = requestor;
};

const usersWithRoleEndpoint = (callBackUrl, partyId, role) => `${callBackUrl || externalAPIPath}/party/${partyId}/users/${role}`;

export const getUsersWithLCARoleForParty = async (ctx, partyId, token) => {
  const newRequestId = v4();
  logger.trace({ ctx, partyId, callBackUrl: ctx.body?.callBackUrl, newRequestId }, 'getUsersWithLCARoleForParty');
  try {
    const { body: usersWithLCARole } = await leasingApiRequest()
      .get(usersWithRoleEndpoint(ctx.body?.callBackUrl, partyId, FunctionalRoleDefinition.LCA.name))
      .set('accept', 'json')
      .set(X_REQUEST_ID, newRequestId)
      .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
      .set(X_DOCUMENT_VERSION, ctx.documentVersion)
      .set('Authorization', `Bearer ${token}`);
    return usersWithLCARole;
  } catch (error) {
    logger.error({ ctx, error, partyId }, 'getUsersWithLCARoleForParty');
  }
  return [];
};

export const getIndividualScreeningReports = async (ctx, partyId, token) => {
  const newRequestId = v4();
  const url = partyScreeningReportsEndpoint(ctx.body?.callBackUrl, partyId);
  logger.trace({ ctx, partyId, url, newRequestId }, 'getIndividualScreeningReports');
  const { body: individualScreeningReports } = await leasingApiRequest()
    .get(url)
    .set('accept', 'json')
    .set(X_REQUEST_ID, newRequestId)
    .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
    .set(X_DOCUMENT_VERSION, ctx.documentVersion)
    .set('Authorization', `Bearer ${token}`);
  logger.trace({ ctx, newRequestId, partyId, reports: JSON.stringify(individualScreeningReports, null, 2) }, 'getIndividualScreeningReports - response');
  return individualScreeningReports;
};

export const postEntity = async (ctx, entity, endpoint, token, opts) => {
  const newRequestId = opts?.reqId ?? v4();
  logger.trace({ ctx, endpoint, entityInfo: { emailInfo: entity?.emailInfo, id: entity?.id }, newRequestId }, 'postEntity');
  try {
    const data = await leasingApiRequest()
      .post(endpoint)
      .send(entity)
      .set('accept', 'json')
      .set(X_REQUEST_ID, newRequestId)
      .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
      .set(X_DOCUMENT_VERSION, ctx.documentVersion)
      .set('Authorization', `Bearer ${token}`);
    return { data };
  } catch (error) {
    logger.error({ ctx, error, entity, endpoint, newRequestId }, 'Failed to process entity');
    return { error };
  }
};

export const patchEntity = async (ctx, entity, endpoint, token, opts) => {
  const newRequestId = opts?.reqId ?? v4();
  try {
    logger.trace({ ctx, endpoint, entity, newRequestId }, 'patchEntity');
    const data = await leasingApiRequest()
      .patch(endpoint)
      .send(entity)
      .set('accept', 'json')
      .set(X_REQUEST_ID, newRequestId)
      .set(X_ORIGINAL_REQUEST_IDS, formatArrayHeaderValues([...(ctx.originalRequestIds || []), ctx.reqId]))
      .set(X_DOCUMENT_VERSION, ctx.documentVersion)
      .set('Authorization', `Bearer ${token}`);
    return { data };
  } catch (error) {
    logger.error({ ctx, error, entity, endpoint, newRequestId }, 'Failed to process entity');
    return { error };
  }
};
