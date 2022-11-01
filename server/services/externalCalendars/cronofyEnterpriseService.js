/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { getCronofyConfigs } from '../../helpers/tenantContextConfigs';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import * as requester from './cronofyRequester';
import { getTenantData, saveTenantMetadata } from '../../dal/tenantsRepo';
import { getUsers } from '../../dal/usersRepo';
import { getTeamsFromTenant } from '../../dal/teamsRepo';
import { sendMessage } from '../pubsub';
import { APP_EXCHANGE, EXTERNAL_CALENDARS_TYPE } from '../../helpers/message-constants';
import { CalendarTargetType } from '../../../common/enums/calendarTypes';
import { getCalendarOps } from './providerApiOperations';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'cronofyEnterpriseService' });

// from https://www.cronofy.com/developers/api
//
// Enterprise Connect allows you to gain access to the calendars of an entire organization.
// This eliminates the need to have each calendar user in an organization individually grant access to their calendar.
//
// An administrator grants you access to their domain and you can use this permission to retrieve access_tokens to calendar accounts on that domain.
// The access_token can then be used against any endpoint in the Cronofy API.

export const getAuthorizationUrl = async ctx => {
  logger.trace({ ctx }, 'getAuthorizationUrl');

  const cronofyConfigs = await getCronofyConfigs(ctx);
  const authUrl = cronofyConfigs.authorizationUrlForEC;
  const delegatedScopes = ['create_calendar', 'read_events', 'create_event', 'delete_event'];

  const urlParams = {
    response_type: 'code',
    client_id: cronofyConfigs.clientId,
    redirect_uri: `https://${ctx.hostname}/tenantAdmin`,
    scope: 'service_account/accounts/unrestricted_access',
    delegated_scope: delegatedScopes.join('%20'),
  };

  return addParamsToUrl(authUrl, urlParams);
};

// IMPORTANT: all cronofy functions that use an access_token, should be called through this function
const callCronofyFunction = async (ctx, { func, options }) => {
  let result;
  const {
    metadata: { externalCalendars },
  } = await getTenantData(ctx);

  try {
    result = await func({ ...options, accessToken: externalCalendars.access_token });
  } catch (error) {
    if (error.statusCode === 401) {
      logger.trace({ ctx, options }, 'refreshing the access token');
      const requestResult = await requester.refreshAccessToken(ctx, externalCalendars.refresh_token);
      await saveTenantMetadata(ctx, ctx.tenantId, { externalCalendars: { ...externalCalendars, ...requestResult } });
      result = await func({ ...options, accessToken: requestResult.access_token });
    } else {
      logger.error({ ctx, options, error }, 'failed to call the cronofy function');
    }
  }

  return result;
};

export const requestDelegatedAccess = async ctx => {
  logger.trace({ ctx }, 'requestDelegatedAccess');
  const users = await getUsers(ctx);
  const teams = await getTeamsFromTenant(ctx.tenantId);
  const usersWithExternalCalendars = users.filter(u => u.externalCalendars.calendarAccount && !u.externalCalendars.revaCalendarId);
  const teamsWithExternalCalendars = teams.filter(t => t.externalCalendars.calendarAccount && !t.externalCalendars.teamCalendarId);
  logger.trace({ ctx, usersWithExternalCalendars, teamsWithExternalCalendars }, 'requestDelegatedAccess - external calendars');

  const { delegatedAccessUrl } = await getCronofyConfigs(ctx);

  const usersDelegateAccessResult = await mapSeries(usersWithExternalCalendars, async user => {
    logger.trace({ ctx, userId: user.id, calendarAccount: user.externalCalendars.calendarAccount }, 'requesting delegated access');

    return await callCronofyFunction(ctx, {
      func: requester.requestDelegatedAccess,
      options: {
        emailAddress: user.externalCalendars.calendarAccount,
        callbackUrl: delegatedAccessUrl,
        state: `${CalendarTargetType.USER}:${user.id}`,
      },
    });
  });
  const teamsDelegateAccessResult = await mapSeries(teamsWithExternalCalendars, async team => {
    logger.trace(
      { ctx, teamId: team.id, calendarAccount: team.externalCalendars.calendarAccount, calendarName: team.externalCalendars.calendarName },
      'requesting delegated access',
    );
    return await callCronofyFunction(ctx, {
      func: requester.requestDelegatedAccess,
      options: {
        emailAddress: team.externalCalendars.calendarAccount,
        callbackUrl: delegatedAccessUrl,
        state: `${CalendarTargetType.TEAM}:${team.id}`,
      },
    });
  });
  return [...usersDelegateAccessResult, ...teamsDelegateAccessResult];
};

const sendMessageToRequestDelegatedAccess = async ctx => {
  logger.trace({ ctx }, 'sendMessageToRequestDelegatedAccess');

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXTERNAL_CALENDARS_TYPE.REQUEST_DELEGATED_ACCESS,
    message: {
      tenantId: ctx.tenantId,
    },
    ctx,
  });

  const { metadata } = await getTenantData(ctx);
  await saveTenantMetadata(ctx, ctx.tenantId, { externalCalendars: { ...metadata.externalCalendars, integrationEnabled: true } });
};

const singleUsedCodeAlreadyUsed = (metadata, callingSingleUseCode) => {
  const { externalCalendars: { singleUseCode } = {} } = metadata;
  return singleUseCode === callingSingleUseCode;
};

export const requestAccessToken = async (ctx, singleUseCode) => {
  const { metadata } = await getTenantData(ctx);
  if (!singleUsedCodeAlreadyUsed(metadata, singleUseCode)) {
    const redirectUrl = `https://${ctx.hostname}/tenantAdmin`;
    const requestResult = await requester.requestAccessToken(ctx, singleUseCode, redirectUrl);
    await saveTenantMetadata(ctx, ctx.tenantId, { externalCalendars: { ...metadata.externalCalendars, ...requestResult, singleUseCode } });
    await sendMessageToRequestDelegatedAccess(ctx);
  } else {
    logger.trace({ ctx }, 'requestAccessToken - duplicate single use code');
  }
};

export const requestSingleDelegatedAccess = async (ctx, entityType, entity) => {
  const id = entity.id;
  logger.trace({ ctx, entityType, id }, 'requestSingleDelegatedAccess - external calendars');

  const { delegatedAccessUrl } = await getCronofyConfigs(ctx);

  const delegatedAccess = await callCronofyFunction(ctx, {
    func: getCalendarOps().requestDelegatedAccess,
    options: {
      emailAddress: entity.externalCalendars.calendarAccount,
      callbackUrl: delegatedAccessUrl,
      state: `${entityType}:${entity.id}`,
    },
  });
  logger.trace({ ctx, entityType, id }, 'requestSingleDelegatedAccess - done');
  return delegatedAccess;
};
