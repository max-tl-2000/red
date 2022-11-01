/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import difference from 'lodash/difference';
import { mapSeries } from 'bluebird';
import * as commService from '../../../services/communication';
import * as telephony from '../../../services/telephony';
import * as validators from '../../helpers/validators';
import { getOneWhere } from '../../../database/factory';
import { ServiceError } from '../../../common/errors';
import { loadUserById } from '../../../services/users';
import { hasRight } from '../../authorization';
import { Rights } from '../../../../common/acd/rights';
import loggerModule from '../../../../common/helpers/logger';
import { execConcurrent } from '../../../../common/helpers/exec-concurrent';
import { validateUser } from '../users';
import config from '../../../config';

const logger = loggerModule.child({ subType: 'api/actions/communications' });

export const loadCommunicationsForParties = async req => {
  const { partyIds, ids } = req.body;
  if (!partyIds || !partyIds.length) {
    throw new ServiceError({ token: 'MISSING_PARTY_IDS', status: 400 });
  }

  const accessibleParties = (
    await execConcurrent(partyIds, async id => ({
      id,
      canAccess: await hasRight(Rights.LOAD_COMMS, req, id),
    }))
  )
    .filter(p => p.canAccess)
    .map(p => p.id);

  if (!accessibleParties.length) {
    logger.warn({ ctx: req, user: req.authUser.userId, partyIds, ids }, 'loadCommunicationsForParties - forbidden');
    throw new ServiceError({ token: 'FORBIDDEN', status: 403 });
  }

  if (!ids) {
    return commService.loadCommunicationsByParties(req, accessibleParties);
  }
  return await commService.loadCommunicationsWithSourceByIdsForParties(req, accessibleParties, ids);
};

export const loadCommunicationsByParty = async req => {
  const partyId = req.params.partyId;
  await validators.party(req, partyId);
  return commService.getCommunicationsByPartiesForCommsPanel(req, [partyId]);
};

export const getInfoForIncomingCall = async req => {
  const commId = req.params.commId;
  validators.uuid(commId, 'INCORRECT_CALL_ID');

  return await commService.getInfoForIncomingCall(req, commId);
};

export const addCommunication = commService.addCommunication;

export const storeCommunicationDraft = commService.storeCommunicationDraft;

export const getDraftsForUserAndParty = async req => {
  const readOnlyServer = config.useReadOnlyServer;
  const ctx = { ...req, readOnlyServer };

  logger.trace({ ctx }, 'getDraftsForUserAndParty');

  return commService.getDraftsForUserAndParty(ctx);
};

export const deleteDraftById = commService.deleteDraftById;

export const computeSmsThreadId = async req => {
  const { personIds } = req.body;

  validators.array(personIds, 'INCORRECT_PERSON_IDS');
  await mapSeries(personIds, async id => await validators.person(req, id));

  return await commService.computeSmsThreadId(req, personIds);
};

export const stopRecording = async req => {
  const id = req.params.commId;
  logger.trace({ ctx: req, id }, 'stopRecording - input params');

  validators.uuid(id, 'INCORRECT_CALL_ID');

  const commEntry = await getOneWhere(req.tenantId, 'Communication', { id });
  if (!commEntry) {
    throw new ServiceError({ token: 'CALL_NOT_FOUND', status: 404 });
  }

  return commService.stopRecording(req, commEntry);
};

export const holdCall = async req => {
  const { commId: id } = req.params;
  logger.trace({ ctx: req, id }, 'holdCall - input params');

  validators.uuid(id, 'INCORRECT_CALL_ID');

  const commEntry = await getOneWhere(req.tenantId, 'Communication', { id });
  if (!commEntry) {
    throw new ServiceError({ token: 'CALL_NOT_FOUND', status: 404 });
  }

  return commService.holdCall(req, commEntry);
};

export const unholdCall = async req => {
  const { commId: id } = req.params;
  logger.trace({ ctx: req, id }, 'unholdCall - input params');

  validators.uuid(id, 'INCORRECT_CALL_ID');

  const commEntry = await getOneWhere(req.tenantId, 'Communication', { id });
  if (!commEntry) {
    throw new ServiceError({ token: 'CALL_NOT_FOUND', status: 404 });
  }

  return commService.unholdCall(req, commEntry);
};

export const transferCall = async req => {
  const id = req.params.commId;
  const to = req.body;
  logger.trace({ ctx: req, id, toObj: to }, 'transferCall - input params');

  validators.uuid(id, 'INCORRECT_CALL_ID');
  const comm = await getOneWhere(req.tenantId, 'Communication', { id });
  if (!comm) throw new ServiceError({ token: 'CALL_NOT_FOUND', status: 404 });

  validators.uuid(to.id, 'INCORRECT_TARGET_ID');

  let targetName;
  if (to.isExternalPhone) {
    targetName = to.fullName;
  } else if (to.isTeam) {
    const team = await getOneWhere(req.tenantId, 'Teams', { id: to.id });
    if (!team) throw new ServiceError({ token: 'TEAM_NOT_FOUND', status: 404 });
    targetName = team.displayName;
  } else {
    const user = await getOneWhere(req.tenantId, 'Users', { id: to.id });
    if (!user) throw new ServiceError({ token: 'USER_NOT_FOUND', status: 404 });
    targetName = user.preferredName;
  }
  await commService.transferCall(req, id, { ...to, targetName });
};

export const makeCallFromPhone = async req => {
  const { from, to } = req.body;
  logger.trace({ ctx: req, makeCallFrom: from, makeCallTo: to }, 'makeCallFromPhone - input params');

  const getErrorToken = () => {
    if (!to) return 'MISSING_CALL_RECIPIENT';
    if (!to.phone) return 'MISSING_PHONE_NUMBER_TO_CALL';
    if (!to.personId) return 'MISSING_PERSON_ID';
    if (!to.partyId) return 'MISSING_PARTY_ID';
    if (!from) return 'MISSING_CALL_SOURCE';
    if (!from.phone) return 'MISSING_PHONE_NUMBER_TO_CALL_FROM';
    return '';
  };

  const errorToken = getErrorToken();
  if (errorToken) throw new ServiceError({ token: errorToken, status: 400 });

  return await telephony.makeCallFromPhone({
    ctx: req,
    user: await loadUserById(req, req.authUser.id),
    from,
    to,
  });
};

export const updateCommunications = async req => {
  const { id: commId } = req.query;
  const { delta, communicationIds } = req.body;
  const userId = req.authUser.userId;
  logger.trace({ ctx: req, commId, delta, communicationIds }, 'updateCommunications - input params');

  const commIds = [commId, ...(communicationIds || [])].filter(id => !!id);
  commIds.forEach(id => validators.uuid(id, 'INCORRECT_COMM_ID'));

  const wasListenedTo = (delta.message || {}).listened;
  const commIdsToMarkAsRead = (wasListenedTo && (await commService.getCommsToMarkAsRead(req, commIds, userId))) || [];
  const readDelta = { ...delta, unread: false };

  const readUpdatedComms = await commService.updateCommunicationEntriesByIds({
    ctx: req,
    ids: commIdsToMarkAsRead,
    delta: readDelta,
    shouldAddActivityLog: true,
  });
  await commService.removeUnreadCommunications(req, commIdsToMarkAsRead);

  const restOfCommIds = difference(commIds, commIdsToMarkAsRead);
  const updatedComms = await commService.updateCommunicationEntriesByIds({ ctx: req, ids: restOfCommIds, delta, shouldAddActivityLog: true });

  return [...readUpdatedComms, ...updatedComms];
};

export const getCommunication = async req => {
  const commId = req.params.commId;
  validators.uuid(commId, 'INVALID_COMM_ID');

  return await commService.getCommunication(req, commId);
};

export const getDataForActiveCall = async req => {
  const commId = req.params.commId;
  logger.trace({ ctx: req, commId }, 'getDataForActiveCall - input params');

  validators.uuid(commId, 'INCORRECT_CALL_ID');

  return await commService.getDataForActiveCall(req, commId);
};

export const getDataForInactiveCall = async req => {
  const threadId = req.params.threadId;
  const partyId = req.query.partyId;
  const personId = req.query.personId;
  logger.trace({ ctx: req, threadId, partyId, personId }, 'getDataForInactiveCall - input params');

  validators.defined(threadId, 'MISSING_THREAD_ID');
  partyId && validators.uuid(partyId, 'INVALID_PARTY_ID');
  personId && validators.uuid(personId, 'INVALID_PERSON_ID');

  return await commService.getDataForInactiveCall(req, threadId, partyId, personId);
};

export const getExternalPhones = commService.getExternalPhones;

export const commsWereReadByUser = async req => {
  const { threadId } = req.params;
  const userId = req.authUser.id;
  validators.defined(threadId, 'MISSING_THREAD_ID');
  await validateUser(req, userId);

  return await commService.commsWereReadByUser(req, threadId, userId);
};

export const markCommsAsReadForPartyByUser = async req => {
  const { partyId } = req.params;
  const userId = req.authUser?.id;

  validators.defined(partyId, 'MISSING_PARTY_ID');
  await validateUser(req, userId);

  return await commService.markCommsAsReadForPartyByUser(req, partyId, userId);
};

export const logPrintCommunication = request => commService.logPrintCommunication(request, request.body);
