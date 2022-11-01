/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../../common/helpers/logger';
import { IMPORT_COMM_DATE_AND_TIME_12H_FORMAT, IMPORT_COMM_DATE_AND_TIME_24H_FORMAT } from '../../../common/date-constants';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartyMemberByProspectId } from '../../dal/partyRepo';
import { getPropertyByName } from '../../dal/propertyRepo';
import { getUserAndTeamsForProspectImport } from '../../dal/usersRepo';
import { getContactEventsByPartyAndFilter } from '../../dal/communicationRepo';
import { addCommunication } from '../../services/communication';
import { parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { DIFF_ACTION_TAG, getDifferences, mapDifferences, mapEntity } from './daff-helpers';

const logger = loggerModule.child({
  subType: 'historicalCommunicationsHandler',
});

const isHistoricalCommunicationValid = (data = {}) => !!data.contactEventType;

const reduceDiffHandler = (headers, action = DIFF_ACTION_TAG.insert) => (acc, row) => {
  switch (action) {
    case DIFF_ACTION_TAG.update:
    case DIFF_ACTION_TAG.insert: {
      const data = mapEntity(headers, row, (key, value) => [key, value]);
      if (isHistoricalCommunicationValid(data)) acc.push(data);
      break;
    }
    default:
      break;
  }
  return acc;
};

const getUpdatedHistoricalCommunications = (ctx, actual, previous, headers) => {
  logger.debug({ ctx, rows: actual && actual.length }, 'historical communications');

  if (!previous || !previous.length) return actual.reduce(reduceDiffHandler(headers), []);

  const diff = getDifferences(headers, previous, actual);
  logger.debug({ ctx, diff }, 'historical communications - diff');

  if (!(diff && diff.data && diff.data.length)) return [];

  return mapDifferences(diff.data, action => reduceDiffHandler(headers, action));
};

const getValueFromCache = (cache, key) => cache && cache.get(key);

const setValueOnCacheIfNotThereAlready = (cache, key, value) => {
  if (!(key && cache) || cache.has(key)) return;
  cache.set(key, value);
};

const getCommDataTemplate = async (ctx, cache, commKey, fnGetObjectFromDb) => {
  if (!commKey) return undefined;
  const commData = getValueFromCache(cache, commKey);
  return commData || (fnGetObjectFromDb && (await fnGetObjectFromDb(ctx, commKey)));
};

const getContactEventTypeForLog = contactEventType => {
  if (contactEventType === DALTypes.ContactEventTypes.CALL) return DALTypes.ContactEventTypes.PHONE;
  return contactEventType || DALTypes.ContactEventTypes.OTHER;
};

const roundContactEventDate = contactEventDate => {
  const minutes = contactEventDate.minute();

  if (minutes < 30) return contactEventDate.startOf('hour');
  if (minutes > 30) return contactEventDate.startOf('hour').add(1, 'h');

  return contactEventDate;
};

const getDateTimeFormat = contactEventDate => {
  const timeFormatExpression = new RegExp('.*(am|pm)$', 'i');
  return timeFormatExpression.test(contactEventDate) ? IMPORT_COMM_DATE_AND_TIME_12H_FORMAT : IMPORT_COMM_DATE_AND_TIME_24H_FORMAT;
};

const parseCommunicationMessage = ({ note, contactEventType, contactEventDate }, property = {}) => {
  const importCommDateTime = parseAsInTimezone(contactEventDate, { format: getDateTimeFormat(contactEventDate), timezone: property.timezone });
  if (!importCommDateTime.isValid()) return undefined;

  const communicationDate = roundContactEventDate(importCommDateTime);

  return {
    text: note,
    type: contactEventType,
    eventDateTime: communicationDate.toJSON(),
    importCommDateTime: importCommDateTime.toJSON(),
  };
};

const parseHistoricalCommunication = async (ctx, rawComm, property, dataCache) => {
  const partyMember = await getCommDataTemplate(ctx, dataCache.membersCache, rawComm.prospectId, getPartyMemberByProspectId);
  if (!(partyMember && partyMember.id)) {
    logger.error({ ctx, prospectId: rawComm.prospectId }, 'Missing party member');
    return undefined;
  }

  setValueOnCacheIfNotThereAlready(dataCache.membersCache, rawComm.prospectId, partyMember);
  const getUserByFullName = async (context, agentName) => await getUserAndTeamsForProspectImport(context, agentName, property.id);
  const agent = await getCommDataTemplate(ctx, dataCache.agentsCache, rawComm.agent, getUserByFullName);
  if (agent && agent.id) {
    setValueOnCacheIfNotThereAlready(dataCache.agentsCache, rawComm.agent, agent);
  }

  const message = parseCommunicationMessage(rawComm, property);
  if (!message) {
    logger.error({ ctx, rawComm }, 'Invalid date or message');
    return undefined;
  }

  const payload = {
    type: DALTypes.CommunicationMessageType.CONTACTEVENT,
    category: DALTypes.CommunicationCategory.HISTORICAL_IMPORT,
    recipients: [partyMember.personId],
    partyId: partyMember.partyId,
    message,
    contactEventType: getContactEventTypeForLog(rawComm.contactEventType),
    names: partyMember.fullName,
  };

  const eventCollisions = await getContactEventsByPartyAndFilter(ctx, partyMember.partyId, payload.message);
  if (eventCollisions && eventCollisions.length) {
    logger.error(
      {
        ctx,
        payload,
        threads: eventCollisions.map(event => event.threadId),
      },
      'Contact event collision',
    );
    return undefined;
  }

  return {
    ...ctx,
    body: {
      ...payload,
    },
    authUser: {
      id: agent && agent.id,
    },
  };
};

const handleHistoricalCommunication = async (ctx, rawComm, dataCache) => {
  const { property: propertyName } = rawComm;

  const property = await getCommDataTemplate(ctx, dataCache.propertiesCache, propertyName, getPropertyByName);
  if (!(property && property.id)) {
    logger.error({ ctx, propertyName }, 'Missing property');
    return false;
  }

  setValueOnCacheIfNotThereAlready(dataCache.propertiesCache, property.name, property);

  const communication = await parseHistoricalCommunication(ctx, rawComm, property, dataCache);
  if (!communication) return false;

  await addCommunication(communication);
  return true;
};

const errorHandler = (message, object) => error => logger.error({ error, ...object }, message);

export const processHistoricalCommunications = async (ctx, actual, previous, headers) => {
  const historicalCommunications = getUpdatedHistoricalCommunications(ctx, actual, previous, headers);
  logger.debug(
    {
      ctx,
      rows: historicalCommunications && historicalCommunications.length,
    },
    'updated historical communications',
  );
  if (!(historicalCommunications && historicalCommunications.length)) return;

  const dataCache = {
    propertiesCache: new Map(),
    membersCache: new Map(),
    agentsCache: new Map(),
  };
  let processed = 0;
  let skiped = 0;
  let error = 0;
  for (const communication of historicalCommunications) {
    const result = await handleHistoricalCommunication(ctx, communication, dataCache).catch(
      errorHandler('error on process historical communication', {
        tenantId: ctx.tenantId,
        communication,
      }),
    );
    processed += !!result;
    skiped += result !== undefined && !result;
    error += result === undefined;
  }

  logger.debug({ ctx, results: { processed, skiped, error } }, 'historical communications results');
};
