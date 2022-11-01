/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';

const env = envVal('NODE_ENV', 'development');

export const APP_EXCHANGE = `${env}_app_exchange`;
export const DELAYED_APP_EXCHANGE = `delayed_${env}_app_exchange`;

export const PAYMENT_MESSAGE_TYPE = {
  PAYMENT_METHOD_NOTIFICATION: 'payment_method_notification',
};

export const SYNC_MESSAGE_TYPE = {
  TENANT_CREATED: 'tenant_created',
  TENANT_UPDATED: 'tenant_updated',
  TENANT_REMOVED: 'tenant_removed',
  TENANT_DATA_CHANGED: 'tenant_changed',
  TENANT_REFRESH_SCHEMA: 'tenant_refresh_schema',
  TENANT_CLEAR_SCHEMA: 'tenant_clear_schema',
  TENANT_GET_AVAILABLE_PHONE_NUMBERS: 'tenant_get_available_phone_numbers',
};

export const COMM_MESSAGE_TYPE = {
  DECISION_SERVICE_EMAIL: 'decision_service_email',
  INBOUND_EMAIL: 'comm_inbound_email',
  OUTBOUND_EMAIL: 'comm_outbound_email',
  OUTBOUND_COMM: 'comm_outbound',
  OUTBOUND_RESET_PASSWORD_EMAIL: 'comm_outbound_reset_password_email',
  OUTBOUND_GENERIC_RESET_PASSWORD_EMAIL: 'comm_outbound_generic_reset_password_email',
  OUTBOUND_GENERIC_YOUR_PASSWORD_CHANGED_EMAIL: 'comm_outbound_generic_your_password_changed_email',
  OUTBOUND_SYSTEM_REGISTRATION_EMAIL: 'comm_outbound_system_registration_email',
  OUTBOUND_EMAIL_STATUS_UPDATE: 'comm_outbound_email_status_update',
  INBOUND_SMS: 'comm_inbound_sms',
  OUTBOUND_SMS: 'comm_outbound_sms',
  OUTBOUND_SMS_STATUS_UPDATE: 'comm_outbound_sms_status_update',
  NEW_USER_REGISTERED: 'new_user_registered',
  CREATE_IP_PHONE_CREDENTIALS: 'create_ip_phone_credentials',
  REMOVE_IP_PHONE_CREDENTIALS: 'remove_ip_phone_credentials',
  TENANT_COMM_PROVIDER_CLEANUP: 'tenant_comm_provider_cleanup',
  COMM_PROVIDER_CLEANUP: 'comm_provider_cleaup',
  WEB_INQUIRY: 'web_inquiry_received',
  OUTBOUND_REGISTRATION_EMAIL: 'comm_outbound_registration_email',
  CREATE_GUEST_APPLICATION: 'comm_create_guest_application',
  OUTBOUND_APPLICATION_INVITATION_EMAIL: 'comm_outbound_application_invitation_email',
  OUTBOUND_APPLICATION_INVITATION_SMS: 'comm_outbound_application_invitation_sms',
  OUTBOUND_INVITATION_FROM_APPLICANT_EMAIL: 'comm_outbound_invitation_from_email',
  OUTBOUND_ROOMMATE_CONTACT_EMAIL: 'comm_outbound_roommate_contact_email',
  OUTBOUND_PRICE_CHANGES_DETECTED_EMAIL: 'comm_outbound_price_changes_detected_email',
  OUTBOUND_COMMS_TEMPLATE_DATA_BINDING_ERROR_EMAIL: 'comm_outbound_comms_template_data_binding_error_email',
  OUTBOUND_DIRECT_MESSAGE: 'comm_outbound_direct_message',
};

export const IMPORT_MESSAGE_TYPE = {
  PROCESS_WORKBOOK: 'import_process_workbook',
  UPLOAD_ASSETS: 'upload_assets',
  IMPORT_LEASE_TEMPLATES: 'import_lease_templates',
  PROCESS_PENDING_MRI_IMPORTS: 'process_pending_mri_imports',
  CLEANUP_RESIDENT_LEGAL_STIPULATION_FLAG: 'cleanup_resident_legal_stipulation_flag',
  CLEANUP_LOSS_LEADER_UNIT_FLAG: 'cleanup_loss_leader_unit_flag',
};

export const EXPORT_MESSAGE_TYPE = {
  UPLOAD_EXPORT_FILE: 'upload_export_file',
  EXPORT_ONE_TO_MANYS: 'export_one_to_manys',
  SIGNED_LEASE_DOCUMENT: 'signed_lease_document',
  EXPORT_TO_MRI: 'export_to_mri',
  EXPORT_FROM_DB: 'export_from_db',
  EXPORT_TO_YARDI: 'export_to_yardi',
};

export const CONVERT_MESSAGE_TYPE = {
  PROCESS_INPUT: 'convert_external_data',
};

export const IMPORT_UPDATES_MESSAGE_TYPE = {
  IMPORT_FILES: 'import_updates_external_platform',
};

export const IMPORT_COHORT_MESSAGE_TYPE = {
  IMPORT_COHORT: 'import_cohort_file',
};

export const PARTY_MESSAGE_TYPE = {
  CLOSE_IMPORTED_PARTIES: 'close_imported_parties',
  ARCHIVE_PARTIES_FROM_SOLD_PROPERTIES: 'archive_parties_from_sold_properties',
  DOCUMENT_HISTORY: 'send_document_history',
  RESEND_DOCUMENT_HISTORY: 'resend_document_history',
};

export const UPLOAD_MESSAGE_TYPE = {
  UPLOAD_DOCUMENTS: 'upload_documents',
  DELETE_DOCUMENTS: 'delete_documents',
  UPLOAD_VOICE_MESSAGE: 'upload_voice_message',
  UPLOAD_PUBLIC_DOCUMENTS: 'upload_public_documents',
};

export const TASKS_MESSAGE_TYPE = {
  PROCESS_ON_DEMAND: 'tasks_process_on_demand',
  COMPLETE_ON_DEMAND: 'tasks_complete_on_demand',
  CANCEL_ON_DEMAND: 'tasks_cancel_on_demand',
};

export const CALLS_QUEUE_MESSAGE_TYPE = {
  CALL_ENQUEUED: 'telephony_call_enqueued',
  CALL_READY_FOR_DEQUEUE: 'telephony_call_ready_for_dequeue',
  CALLBACK_REQUESTED: 'telephony_callback_requested',
  VOICEMAIL_REQUESTED: 'telephony_voicemail_requested',
  TRANSFER_TO_NUMBER_REQUESTED: 'telephony_transfer_to_number_requested',
  HANGUP: 'telephony_hangup',
  USER_AVAILABLE: 'telephony_user_available',
  CALL_QUEUE_TIMEOUT: 'telephony_call_queue_timeout',
  END_OF_DAY: 'telephony_end_of_day',
  ALL_AGENTS_OFFLINE: 'telephony_all_agents_offline',
};

export const SCREENING_MESSAGE_TYPE = {
  SUBMIT_REQUEST_RECEIVED: 'submit_request_received',
  SCREENING_RESPONSE_RECEIVED: 'submit_response_received',
  PARTY_MEMBERS_CHANGED: 'party_members_changed',
  QUOTE_PUBLISHED: 'quote_published',
  APPLICANT_DATA_UPDATED: 'applicant_data_updated',
  APPLICATION_HOLD_STATUS_CHANGED: 'application_hold_status_changed',
  PAYMENT_NOTIFICATION_RECEIVED: 'payment_notification_received',
  PAYMENT_PROCESSED: 'payment_processed',
  SCREENING_RESPONSE_VALIDATION: 'screening_reponse_validation',
  POLL_SCREENING_UNRECEIVED_RESPONSES: 'poll_screening_unreceived_responses',
  LONG_RUNNING_SCREENING_REQUESTS: 'long_running_screening_requests',
  SCREENING_SUBMIT_VIEW_REQUEST_RECEIVED: 'screening_submit_view_request_received',
  RERUN_EXPIRED_SCREENING: 'rerun_expired_screening',
  FORCE_RESCREENING_REQUESTED: 'force_rescreening_requested',
  PARTY_CLOSED: 'party_closed',
  SEND_SSN_CHANGED: 'send_ssn_changed',
  STUCK_REQUEST_DETECTED: 'stuck_request_detected',
  APPLICANT_MEMBER_TYPE_CHANGED: 'applicant_member_type_changed',
  PARTY_ARCHIVED: 'party_archived',

  // for V2
  REQUEST_APPLICANT_REPORT: 'request_applicant_report',
};

export const LEASE_MESSAGE_TYPE = {
  PUBLISH_LEASE: 'publish_lease',
  LEASE_STATUS_UPDATE: 'lease_status_update',
  FETCH_SIGNED_LEASE: 'fetch_signed_lease',
  FETCH_LEASES_STATUS: 'fetch_leases_status',
};

export const TRANSACTIONS_MESSAGE_TYPE = {
  FETCH_AND_STORE: 'fetch_and_store_transactions',
};

export const JOBS_MESSAGE_TYPE = {
  MARK_USERS_UNAVAILABLE: 'mark_users_unavailable',
  CHECK_INCOMING_FILES: 'check_incoming_files',
  MONITOR_DATABASE: 'monitor_database',
  SCREENING_MONITOR: 'screening_monitor',
  CLEANUP_TESTING_TENANTS: 'cleanup_testing_tenants',
  DETACH_PROGRAM_PHONE_NUMBERS: 'detach_program_phone_numbers',
  CLEANUP_PHYSICAL_ASSETS: 'cleanup_physical_assets',
  START_LEASE_RENEWAL_CYCLE: 'start_lease_renewal_cycle',
  VACATE_PARTY_MEMBERS: 'vacate_party_members',
  PARTY_DOCUMENTS_MONITOR: 'party_documents_monitor',
  COMMS_MONITOR: 'comms_monitor',
  IMPORT_AND_PROCESS_PARTY_WORKFLOWS: 'import_and_process_party_workflows',
  CLEANUP_OLD_RECORDS_FROM_BIG_TABLES: 'cleanup_old_records_from_big_tables',
  MRI_EXPORT_MONITOR: 'mri_export_monitor',
  ASSIGN_AL_TO_RS_TEAM: 'assign_active_lease_to_resident_service_team',
  SYNC_BM_LEASE_SIGNATURES: 'sync_bm_lease_signatures',
  APPLICATION_DECLINED_HANDLER: 'application_declined_handler',
};

export const PROPERTY_MESSAGE_TYPE = {
  UPDATE_POST_MONTH: 'update_post_month',
};

export const EXTERNAL_CALENDARS_TYPE = {
  REQUEST_DELEGATED_ACCESS: 'request_delegated_access',
  PERFORM_INTEGRATION_SETUP_FOR_ACCOUNT: 'perform_integration_setup_for_account',
  PERFORM_ACTIONS_ON_CALENDAR_ACCOUNT: 'perform_actions_on_calendar_account',
  CLEANUP_CALENDAR_ACCOUNTS: 'cleanup_calendar_accounts',
  SYNC_CALENDAR_EVENTS: 'sync_calendar_events',
  USER_REVA_EVENT_UPDATED: 'user_reva_event_updated',
  USER_PERSONAL_EVENT_UPDATED: 'user_personal_event_updated',
  TEAM_EVENT_UPDATED: 'team_event_updated',
};

export const BULK_EMAILS_TYPE = {
  SEND_BULK_EMAILS: 'send_bulk_emails',
};

export const REPLICATION_MESSAGE_TYPE = {
  REFRESH_PUBLICATION: 'refresh_publication',
};

export const UNIVERSITY_MESSAGE_TYPE = {
  SANDBOX_CREATION_REQUEST: 'request_sandbox_creation',
  CREATE_SANDBOX: 'create_sandbox',
};

export const DELAYED_MESSAGE_TYPE = {
  PROCESS_DELAYED_MESSAGE: 'process_delayed_message',
  DELETE_SENDGRID_TEMPLATE: 'delete_sendgrid_template_request',
  DELETE_POST_RECIPIENT_RESULT_FILE: 'delete_post_recipient_result_file',
};

export const HEADER_MESSAGE_ID = 'x-reva-message-id';
export const HEADER_ORIGINALLY_SENT = 'x-reva-originally-sent';
export const HEADER_TENANT_ID = 'x-reva-tenant-id';
export const HEADER_REQUEST_ID = 'x-reva-request-id';
export const HEADER_ORIGINAL_REQUEST_IDS = 'x-reva-original-request-ids';
export const HEADER_DOCUMENT_VERSION = 'x-reva-document-version';
export const HEADER_DELAY = 'x-delay';
