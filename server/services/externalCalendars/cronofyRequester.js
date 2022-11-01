/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Cronofy from 'cronofy';
import { getCronofyConfigs } from '../../helpers/tenantContextConfigs';
import { CalendarPermissionLevel } from '../../../common/enums/calendarTypes';

export const requestAccessToken = async (ctx, singleUseCode, redirectUrl) => {
  const cronofyConfigs = await getCronofyConfigs(ctx);

  const options = {
    client_id: cronofyConfigs.clientId,
    client_secret: cronofyConfigs.clientSecret,
    grant_type: 'authorization_code',
    code: singleUseCode,
    redirect_uri: redirectUrl,
  };

  // accessTokenResult shape:
  // {
  //   "sub": "{your-sub},
  //   "scope": "read_write",
  //   "account_id": "{your-account-id}",
  //   "expires_in": 10800,
  //   "token_type": "bearer",
  //   "access_token": "{your-access-token}",
  //   "refresh_token": "{your-refresh-token}",
  //   "linking_profile": {
  //     "profile_id": "pro_Wp-xZI2@z1PPAAMa",
  //     "profile_name": "{example-email}",
  //     "provider_name": "google"
  //   }
  // }
  return await new Cronofy({}).requestAccessToken(options);
};

export const refreshAccessToken = async (ctx, currentRefreshToken) => {
  const cronofyConfigs = await getCronofyConfigs(ctx);

  const options = {
    client_id: cronofyConfigs.clientId,
    client_secret: cronofyConfigs.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
  };

  const refreshTokenResult = await new Cronofy({}).refreshAccessToken(options);
  // eslint-disable-next-line camelcase
  const { refresh_token, access_token, expires_in } = refreshTokenResult;

  return {
    refresh_token,
    access_token,
    expires_in,
  };
};

export const requestDelegatedAccess = async ({ accessToken, emailAddress, callbackUrl, state }) => {
  const options = {
    access_token: accessToken,
    email: emailAddress,
    callback_url: callbackUrl,
    scope: 'create_calendar create_event delete_event read_events',
    state,
  };

  return await new Cronofy({}).authorizeWithServiceAccount(options);
};

export const createNotificationChannel = async requestData => {
  const { accessToken, calendarId, notificationUrl } = requestData;

  const options = {
    access_token: accessToken,
    callback_url: notificationUrl,
    filters: {
      calendar_ids: [calendarId],
      only_managed: false,
    },
  };

  return await new Cronofy({}).createNotificationChannel(options);
};

export const closeNotificationChannel = async requestData => {
  const { accessToken, channelId } = requestData;

  const options = {
    access_token: accessToken,
    channel_id: channelId,
  };

  return await new Cronofy({}).deleteNotificationChannel(options);
};

// for reponse event shape see: server/services/externalCalendars/requests-responses/get-free-busy
export const getEvents = async requestData => {
  const { accessToken, ...rest } = requestData;

  const options = {
    access_token: accessToken,
    include_ids: true,
    tzid: 'Etc/UTC',
    ...rest,
  };

  const result = await new Cronofy({}).freeBusy(options);

  return {
    pages: result.pages,
    events: result.free_busy,
  };
};

// event shape
// {
//   id: '9b631480-92fa-4695-b783-ba0940f09186',
//   userIds: ['14453ce1-b233-4ce3-aaef-cfea39dd5278'],
//   partyId: 'ce11adae-2c15-4734-8a51-3fdb5e9ee2d8',
//   metadata: {
//     startDate: '2018-03-27T14:00:00.000Z',
//     endDate: '2018-03-27T14:00:00.000Z',
//   },
// }
export const createEvent = async requestData => {
  const { accessToken, calendarId, eventId, ...rest } = requestData;

  const options = {
    access_token: accessToken,
    calendar_id: calendarId,
    event_id: eventId,
    ...rest,
  };

  return await new Cronofy({}).createEvent(options);
};

export const createRevaCalendar = async requestData => {
  const { accessToken, ...rest } = requestData;

  const options = {
    access_token: accessToken,
    ...rest,
  };
  const { calendar } = await new Cronofy({}).createCalendar(options);
  return calendar;
};

export const getExternalCalendars = async requestData => {
  const options = {
    access_token: requestData.accessToken,
  };

  const { calendars } = await new Cronofy({}).listCalendars(options);
  return calendars;
};

export const removeEvent = async requestData => {
  const options = {
    access_token: requestData.accessToken,
    calendar_id: requestData.calendarId,
    event_id: requestData.eventId,
  };
  return await new Cronofy({}).deleteEvent(options);
};

export const removeExternalEvent = async requestData => {
  const options = {
    access_token: requestData.accessToken,
    calendar_id: requestData.calendarId,
    event_uid: requestData.eventId,
  };
  return await new Cronofy({}).deleteExternalEvent(options);
};

export const removeAllEvents = async requestData => {
  const options = {
    access_token: requestData.accessToken,
    calendar_ids: requestData.calendarIds,
  };
  return await new Cronofy({}).bulkDeleteEvents(options);
};

export const revokeAuthorization = async requestData => {
  const options = {
    client_id: requestData.clientId,
    client_secret: requestData.clientSecret,
    token: requestData.refreshToken,
  };

  return await new Cronofy({}).revokeAuthorization(options);
};

export const setCalendarPermissionToUnrestricted = async requestData => {
  const options = {
    access_token: requestData.accessToken,
    permissions: [
      {
        calendar_id: requestData.calendarId,
        permission_level: CalendarPermissionLevel.UNRESTRICTED,
      },
    ],
  };

  return await new Cronofy({}).elevatedPermissions(options);
};

export const createSmartInvite = async requestData => await new Cronofy({}).createSmartInvite(requestData);

export const cancelSmartInvite = async requestData => await new Cronofy({}).cancelSmartInvite(requestData);

/*   example call
{
  "batch": [
    {
      "method": "DELETE",
      "relative_url": "/v1/calendars/cal_123_abc/events",
      "data": {
        "event_id": "456"
      }
    },
    {
      "method": "POST",
      "relative_url": "/v1/calendars/cal_123_abc/events",
      "data": {
        "event_id": "qTtZdczOccgaPncGJaCiLg",
        "description": "Discuss plans for the next quarter.",
        "start": "2014-08-05T15:30:00Z",
        "end": "2014-08-05T17:00:00Z",
        "location": {
          "description": "Board room"
        }
      }
    }
  ]
}
*/

export const batchOperations = async requestData => {
  const options = {
    access_token: requestData.accessToken,
    batch: requestData.options,
  };
  return await new Cronofy({}).batch(options);
};
