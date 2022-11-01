/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const EventTypes = {
  BROADCAST: 'broadcast',
  MAIL_RECEIVED: 'mail received',
  MAIL_SENT: 'mail sent',
  SMS_RECEIVED: 'sms_received',
  SMS_SENT: 'sms_sent',
  DIRECT_MESSAGE_SENT: 'direct_message_sent',
  DIRECT_MESSAGE_TO_RXP: 'direct_message_to_rxp',
  POST_TO_RXP: 'post_to_rxp',
  REFRESH_TENANT_SCHEMA_DONE: 'refresh tenant schema done',
  CLEAR_TENANT_SCHEMA_DONE: 'clear tenant schema done',
  COMMS_PROVIDER_OPERATION_FAILURE: 'communication provider operation failure',
  PHONENO_ASSIGNATION_FAILURE: 'phone number assignation failure',
  PHONENO_ASSIGNATION_SUCCESS: 'phone number assignation success',
  COMM_PROVIDER_CLEANUP_DONE: 'comms provider cleanup done',
  SIP_UPDATED: 'sip updated',
  USERS_UPDATED: 'users updated',
  USERS_AVAILABILITY_CHANGED: 'users availability changed',
  REMOVE_TENANT_PLIVO_CLEANUP_DONE: 'remove tenant Plivo cleanup done',
  COMM_PROVIDER_SETUP_DONE: 'communication provider setup done',
  JOB_CREATED: 'job created',
  JOB_PROGRESS: 'job progress',
  JOB_UPDATED: 'job updated',
  PARTY_UPDATED: 'party updated',
  PARTY_ASSIGNED: 'party assigned',
  OWNER_CHANGED: 'owner changed',
  PROCESS_TASK_EVENT: 'process task event',
  CREATE_PLIVO_GUEST_APPLICATION_DONE: 'create guest application done',
  APPLICATION_CREATED: 'application created',
  APPLICATION_UPDATED: 'application updated',
  PARTY_DETAILS_UPDATED: 'update party details',
  LEASE_CREATED: 'lease_created',
  LEASE_UPDATED: 'lease_updated',
  LEASE_PUBLISHED: 'lease_published',
  UPDATE_TYPES_PASSWORD: 'update types password',
  COMMUNICATION_UPDATE: 'communication created or updated',
  OUTGOING_CALL_INITIATED: 'outgoing call initiated',
  PAYMENT_RECEIVED: 'payment_received',
  WAIVE_APPLICATION_FEE: 'waive application fee',
  TENANT_UPDATE_DONE: 'tenant update done',
  BROADCAST_WEB_UPDATED: 'broadcast_web_updated',
  CALL_ANSWERED: 'call answered',
  CALL_TERMINATED: 'call terminated',
  START_WRAPUP_CALL: 'start call wrap-up',
  CREATE_IP_PHONE_CREDENTIALS_FAILED: 'create ip phone credentials failed',
  REMOVE_IP_PHONE_CREDENTIALS_FAILED: 'remove ip phone credentials failed',
  FORCE_LOGOUT: 'force logout',
  FORCE_LOGOUT_PLUS_ADMIN: 'force logout plus admin',
  CLOSE_IMPORTED_PARTIES_COMPLETED: 'close imported parties completed',
  INVENTORY_HOLD: 'inventory hold',
  INVENTORY_UPDATED: 'inventory updated',
  USER_SOCKET_DISCONNECTED: 'user socket disconnected',
  USER_HAS_WS_CONNECTION_QUERY: 'user has socket connection query',
  SYNC_CALENDAR_DATA_COMPLETED: 'sync calendar data completed',
  QUOTES_UPDATED: 'quotes_updated',
  QUOTE_PUBLISHED_FAILED: 'quote_published_failed',
  UNIVERSITY_SANDBOX_CREATION_STARTED: 'university_sandbox_creation_started',
  UNIVERSITY_SANDBOX_CREATION_COMPLETED: 'university_sandbox_creation_completed',
  UNIVERSITY_SANDBOX_CREATION_FAILED: 'university_sandbox_creation_failed',
  LOAD_APPOINTMENTS_EVENT: 'load appointments event',
  TENANT_AVAILABLE_NUMBERS_COMPLETED: 'tenant available numbers completed',
  PERSON_MERGED: 'person merged',
  DOCUMENTS_UPLOADED: 'documents_uploaded',
  DOCUMENTS_UPLOADED_FAILURE: 'documents_uploaded_failure',
  DOCUMENTS_DELETED: 'documents_deleted',
  POST_CREATED: 'post_created',
  POST_UPDATED: 'post_updated',
  POST_DELETED: 'post_deleted',
  POST_SENT: 'post_sent',
  POST_SENT_FAILURE: 'post_sent_failure',
  REASSIGN_AL_TO_RS_TEAM_COMPLETED: 'reassign active leases to resident service team completed',
  NEW_PAYMENT_METHOD: 'new_payment_method',
  NEW_SCHEDULED_PAYMENT: 'new_scheduled_payment',
  TEAMS_CALL_QUEUE_CHANGED: 'teams_call_queue_changed',
};

export default EventTypes;
