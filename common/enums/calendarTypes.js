/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const CalendarActionTypes = {
  ADD_ACCOUNT: 'add_account',
  UPDATE_ACCOUNT: 'update_account',
  REMOVE_ACCOUNT: 'remove_account',
  NO_ACTION: 'no_action',
  RENAME_CALENDAR: 'rename_calendar',
};

export const CalendarTargetType = {
  TEAM: 'Team',
  USER: 'User',
};

// when we request access to an account, the permission_level is set by default to 'sandbox' for all the existing calendars
// when we create a new calendar through Cronofy API, the permission_level to that calendar is set by default to 'unrestricted'
// to be able to delete events created outside of Reva app, the permission_level to that calendar should be set to 'unrestricted'
export const CalendarPermissionLevel = {
  SANDBOX: 'sandbox',
  UNRESTRICTED: 'unrestricted',
};

// details here: https://www.cronofy.com/developers/api/#free-busy
export const EventStatus = {
  TENTATIVE: 'tentative', // the user is probably busy for this period of time
  BUSY: 'busy', // the user is busy for this period of time
  FREE: 'free', // the user is free for this period of time
  UNKNOWN: 'unknown', // the status of the period is unknown
};

export const CalendarUserEventType = {
  PERSONAL: 'personal',
  REVA: 'reva',
  SELF_BOOK: 'self book',
  SICK_LEAVE: 'sick leave',
};

// from: https://www.cronofy.com/developers/api/#push-notifications
// Current types:
// verification - sent after a channel is created to test that the specified callback URL is valid
// change - signifies that a change has occurred to the user's events so you should make a request to fetch those changes
// profile_disconnected - signifies that one or more of the user's calendar profiles has become disconnected and the user
//                        will need to reauthorize the affected calendar account. Profile Information gives current
//                        connection status for all profiles associated with a user.
// profile_initial_sync_completed - signifies that the initial sync of the user's calendar events has completed, you may wish
//                                  to perform an additional sync when receiving this to ensure you have seen all their events.
//                                  Note that you will not receive this notification if the initial sync completed before
//                                  the channel was created.
export const NotificationType = {
  VERIFICATION: 'verification',
  CHANGE: 'change',
  PROFILE_DISCONNECTED: 'profile_disconnected',
  PROFILE_INITIAL_SYNC_COMPLETED: 'profile_initial_sync_completed',
};

export const cronofyRsvpStatusTypes = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
};
