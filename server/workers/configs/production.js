/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import envVal from '../../../common/helpers/env-val';
import {
  SYNC_MESSAGE_TYPE,
  COMM_MESSAGE_TYPE,
  IMPORT_MESSAGE_TYPE,
  EXPORT_MESSAGE_TYPE,
  TASKS_MESSAGE_TYPE,
  CONVERT_MESSAGE_TYPE,
  UPLOAD_MESSAGE_TYPE,
  IMPORT_UPDATES_MESSAGE_TYPE,
  IMPORT_COHORT_MESSAGE_TYPE,
  LEASE_MESSAGE_TYPE,
  JOBS_MESSAGE_TYPE,
  CALLS_QUEUE_MESSAGE_TYPE,
  PARTY_MESSAGE_TYPE,
  PROPERTY_MESSAGE_TYPE,
  EXTERNAL_CALENDARS_TYPE,
  REPLICATION_MESSAGE_TYPE,
  UNIVERSITY_MESSAGE_TYPE,
  DELAYED_MESSAGE_TYPE,
  BULK_EMAILS_TYPE,
  PAYMENT_MESSAGE_TYPE,
} from '../../helpers/message-constants';

module.exports = {
  messageRetryDelay: 30000, // it's not read from ENV as we can't change the queue declaration after it's created
  failedMessageLoggedAfter: envVal('AMQP_MSG_RETRY_LOG', 5), // each five retries we log an error
  noOfFastRetries: envVal('AMQP_MSG_FAST_RETRIES', 3), // no of "FAST" retries before moving to a longer wait queue
  defaultConsumersPerQueue: envVal('AMQP_CONSUMERS_PER_QUEUE', 10), // number of consumers per queue
  defaultCleanTenantsAfterInactivity: envVal('UNIVERSITY_CLEANUP_AFTER_DAYS', 5), // number of days with activity on a training tenant after which we remove it
  dbProfiling: {
    enabled: envVal('REVA_DB_PROFILING_ENABLED', true),
    longReport: envVal('REVA_DB_PROFILING_LONG_REPORT', false),
    logMissingKnexInCtx: envVal('REVA_DB_PROFILING_LOG_MISSING_KNEX_IN_CTX', false),
  },
  ctxCache: {
    isCtxCacheEnabled: envVal('ENABLE_CONTEXT_CACHE', true),
    shouldLogCtxCache: envVal('SHOULD_LOG_CONTEXT_CACHE', true),
  },
  workerConfig() {
    const { tenantDataChanged, tenantRefreshSchema, clearTenantSchema } = require('../sync');
    const { tenantCreatedHandler, tenantRemovedHandler, getAvailablePhoneNumbers } = require('../tenantHandler');
    const {
      decisionServiceEmailHandler,
      outboundRegistrationEmail,
      outboundMailSent,
      outboundCommSent,
      outboundSystemRegistrationEmailSent,
      outboundResetPasswordEmailSent,
      outboundGenericResetPasswordEmailSent,
      outboundGenericYourPasswordChangedEmailSent,
      outboundMailStatusUpdate,
      outboundApplicationInvitationEmailSent,
      outboundInvitationFromApplicantEmailSent,
      outboundPersonToPersonEmailSent,
      outboundPriceChangesDetectedEmailSent,
      outboundCommsTemplateDataBindingErrorEmailSent,
      outboundDirectMessageSent,
    } = require('../communication/emailHandlers');
    const { inboundMailReceived } = require('../communication/inboundEmailHandler');
    const { inboundSmsReceived, outboundSmsSent, outboundSmsStatusUpdate, outboundApplicationInvitationSmsSent } = require('../communication/smsHandler');
    const { handleWebInquiry } = require('../communication/webInquiryHandler');
    const { requestSandboxCreationHandler, createSandboxHandler } = require('../university/universityHandler');
    const { cleanupTrainingTenants } = require('../university/cleanupHandler');
    const {
      onTenantUpdated,
      onTenantCommProviderCleanup,
      onUserRegistered,
      onCreateIpPhoneCredentials,
      onRemoveIpPhoneCredentials,
      onCurrentEnvCleanup,
      createGuestApplication,
    } = require('../communication/commProviderIntegration');
    const {
      callEnqueued,
      callReadyForDequeue,
      callbackRequested,
      voicemailRequested,
      transferToNumberRequested,
      callHungUp,
      handleUserAvailable,
      callQueueTimeExpired,
      handleEndOfDay,
      handleAllAgentsOffline,
    } = require('../communication/callQueueHandler');
    const { importTenantData } = require('../upload/uploadInventoryHandler.js');
    const { uploadAssets, cleanupPhysicalAssets } = require('../upload/uploadAssetsHandler');
    const { uploadDocuments, deleteDocuments } = require('../upload/uploadDocumentsHandler');
    const { uploadPublicDocuments } = require('../upload/uploadPublicDocumentsHandler');
    const { processTasks, markTasksCompleted, markTasksCanceled } = require('../tasks/taskHandler');
    const { convertInputData } = require('../upload/uploadConverterHandler');
    const { importUpdates, importCohortFile } = require('../upload/uploadUpdatesHandler');
    const { importLeaseTemplates } = require('../lease/importLeaseTemplatesHandler');
    const { cleanupResidentLegalStipulationFlag } = require('../party/cleanupLegalStipulationFlagHandler');
    const { cleanupLossLeaderUnitFlag } = require('../party/cleanupLossLeaderUnitFlagHandler');
    const { publishLease } = require('../lease/publishLeaseHandler');
    const { fetchLeasesStatus } = require('../lease/fetchLeasesStatusHandler');
    const { fetchSignedLeaseDocuments } = require('../lease/fetchSignedLeaseHandler');
    const { exportSignedLeaseDocument } = require('../lease/postSignedLeaseDocument');
    const { RENTAPP_UPLOAD_MESSAGE_TYPE } = require('../../../rentapp/common/message-constants');
    const {
      handleApplicationUploadResponseReceived,
      handleDeleteApplicationDocuments,
    } = require('../../../rentapp/server/workers/upload/upload-documents-handler');

    const { handleUploadExportFile } = require('../upload/uploadExportsHandler');
    const { runExportOneToManys } = require('../export/exportOneToManys');
    const { exportFromDB } = require('../export/exportFromDB');
    const { exportToMri } = require('../../export/mri/export');
    const { exportToYardi } = require('../../export/yardi/exportToYardi');

    const { loadTestingHandler } = require('../testing');
    const { markUsersUnavailable } = require('../jobs/markUsersUnavailableHandler');
    const { checkIncomingFiles } = require('../jobs/checkIncomingFilesHandler');
    const { closeImportedParties } = require('../party/closeImportedPartiesHandler');
    const { archivePartiesFromSoldProperties } = require('../party/archivePartiesFromSoldPropertiesHandler');
    const { vacatePartyMembers } = require('../party/vacatePartyMembersHandler');
    const { applicationDeclinedHandler } = require('../party/applicationDeclinedHandler');
    const { syncBMLeaseSignatures } = require('../lease/syncBMLeaseSignaturesHandler');
    const { updatePostMonth } = require('../property/updatePostMonthHandler');
    const { sendPartyDocumentHistory, resendPartyDocumentHistory } = require('../party/documentHistoryHandler');
    const { requestDelegatedAccess } = require('../externalCalendars/requestDelegatedAccessHandler');
    const { performIntegrationSetupForAccount } = require('../externalCalendars/accountIntegrationSetupHandler');
    const {
      processEventUpdatedNotification: processUserRevaEventUpdatedNotification,
    } = require('../externalCalendars/eventUpdatedHandlers/userRevaEventUpdatedHandler');
    const {
      processEventUpdatedNotification: processUserPersonalEventUpdatedNotification,
    } = require('../externalCalendars/eventUpdatedHandlers/userPersonalEventUpdatedHandler');
    const {
      processEventUpdatedNotification: processTeamEventUpdatedNotification,
    } = require('../externalCalendars/eventUpdatedHandlers/teamEventUpdatedHandler');
    const { performActionsForCalendarAccount } = require('../externalCalendars/performActionsForCalendarAccountHandler');
    const { cleanupCalendarAccounts } = require('../externalCalendars/cleanupCalendarAccountsHandler');
    const { syncCalendarEvents } = require('../externalCalendars/syncCalendarEventsHandler');
    const { uploadVoiceMessages } = require('../upload/uploadVoiceMessagesHandler');
    const { screeningMonitor } = require('../property/screeningMonitorHandler');
    const { monitorDatabase } = require('../../database/monitor');
    const { refreshPublication } = require('../../replication/replicationSetup');
    const { detachProgramPhoneNumbers } = require('../communication/detachPhoneNumbersHandler');
    const { checkPartyDocuments } = require('../jobs/checkPartyDocumentsHandler');
    const { commsMonitor } = require('../property/commsMonitorHandler');
    const { importAndProcessPartyWorkflows } = require('../jobs/importAndProcessPartyWorkflowsHandler');
    const { processDelayedMessage } = require('../delayedMessages/delayedMessageHandler');
    const { processDeleteSendGridTemplate } = require('../delayedMessages/deleteSendGridTemplateHandler');
    const { processDeletePostRecipientResultFile } = require('../delayedMessages/deletePostRecipientFileHandler');
    const { cleanupOldRecordsFromBigTables } = require('../jobs/cleanupOldRecordsFromBigTablesHandler');
    const { handleMRIExportMonitor } = require('../jobs/handleMRIExportMonitor');
    const { processAndSendBulkEmails } = require('../bulkEmails/sendBulkEmailsHandler');
    const { reassignActiveLeaseToRSTeams } = require('../jobs/reassignActiveLeaseToRSTeams');
    const { handlePaymentMethodNotification } = require('../../../resident/server/services/payment');

    return {
      sync: {
        queue: 'sync_queue',
        topics: {
          [SYNC_MESSAGE_TYPE.TENANT_CREATED]: tenantCreatedHandler,
          [SYNC_MESSAGE_TYPE.TENANT_REMOVED]: tenantRemovedHandler,
          [SYNC_MESSAGE_TYPE.TENANT_DATA_CHANGED]: tenantDataChanged,
          [SYNC_MESSAGE_TYPE.TENANT_REFRESH_SCHEMA]: tenantRefreshSchema,
          [SYNC_MESSAGE_TYPE.TENANT_CLEAR_SCHEMA]: clearTenantSchema,
          [SYNC_MESSAGE_TYPE.TENANT_GET_AVAILABLE_PHONE_NUMBERS]: getAvailablePhoneNumbers,
        },
        noOfConsumers: 1,
      },
      mail: {
        queue: 'mail_queue',
        topics: {
          [COMM_MESSAGE_TYPE.DECISION_SERVICE_EMAIL]: decisionServiceEmailHandler,
          [COMM_MESSAGE_TYPE.OUTBOUND_REGISTRATION_EMAIL]: outboundRegistrationEmail,
          [COMM_MESSAGE_TYPE.INBOUND_EMAIL]: inboundMailReceived,
          [COMM_MESSAGE_TYPE.OUTBOUND_EMAIL]: outboundMailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_COMM]: outboundCommSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_SYSTEM_REGISTRATION_EMAIL]: outboundSystemRegistrationEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_RESET_PASSWORD_EMAIL]: outboundResetPasswordEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_GENERIC_RESET_PASSWORD_EMAIL]: outboundGenericResetPasswordEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_GENERIC_YOUR_PASSWORD_CHANGED_EMAIL]: outboundGenericYourPasswordChangedEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_EMAIL_STATUS_UPDATE]: outboundMailStatusUpdate,
          [COMM_MESSAGE_TYPE.OUTBOUND_APPLICATION_INVITATION_EMAIL]: outboundApplicationInvitationEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_INVITATION_FROM_APPLICANT_EMAIL]: outboundInvitationFromApplicantEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_ROOMMATE_CONTACT_EMAIL]: outboundPersonToPersonEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_PRICE_CHANGES_DETECTED_EMAIL]: outboundPriceChangesDetectedEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_COMMS_TEMPLATE_DATA_BINDING_ERROR_EMAIL]: outboundCommsTemplateDataBindingErrorEmailSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_DIRECT_MESSAGE]: outboundDirectMessageSent,
        },
      },
      sms: {
        queue: 'sms_queue',
        topics: {
          [COMM_MESSAGE_TYPE.INBOUND_SMS]: inboundSmsReceived,
          [COMM_MESSAGE_TYPE.OUTBOUND_SMS]: outboundSmsSent,
          [COMM_MESSAGE_TYPE.OUTBOUND_SMS_STATUS_UPDATE]: outboundSmsStatusUpdate,
          [COMM_MESSAGE_TYPE.CREATE_GUEST_APPLICATION]: createGuestApplication,
          [COMM_MESSAGE_TYPE.OUTBOUND_APPLICATION_INVITATION_SMS]: outboundApplicationInvitationSmsSent,
        },
      },
      webInquiry: {
        queue: 'web_inquiry_queue',
        topics: {
          [COMM_MESSAGE_TYPE.WEB_INQUIRY]: handleWebInquiry,
        },
        noOfConsumers: 2,
      },
      telephony: {
        queue: 'plivo_queue',
        topics: {
          [SYNC_MESSAGE_TYPE.TENANT_UPDATED]: onTenantUpdated,
          [COMM_MESSAGE_TYPE.NEW_USER_REGISTERED]: onUserRegistered,
          [COMM_MESSAGE_TYPE.CREATE_IP_PHONE_CREDENTIALS]: onCreateIpPhoneCredentials,
          [COMM_MESSAGE_TYPE.REMOVE_IP_PHONE_CREDENTIALS]: onRemoveIpPhoneCredentials,
          [COMM_MESSAGE_TYPE.TENANT_COMM_PROVIDER_CLEANUP]: onTenantCommProviderCleanup,
          [COMM_MESSAGE_TYPE.COMM_PROVIDER_CLEANUP]: onCurrentEnvCleanup,
        },
      },
      import: {
        queue: 'import_queue',
        topics: {
          [IMPORT_MESSAGE_TYPE.UPLOAD_ASSETS]: uploadAssets,
          [IMPORT_MESSAGE_TYPE.PROCESS_WORKBOOK]: importTenantData,
          [IMPORT_MESSAGE_TYPE.IMPORT_LEASE_TEMPLATES]: importLeaseTemplates,
          [IMPORT_MESSAGE_TYPE.CLEANUP_RESIDENT_LEGAL_STIPULATION_FLAG]: cleanupResidentLegalStipulationFlag,
          [IMPORT_MESSAGE_TYPE.CLEANUP_LOSS_LEADER_UNIT_FLAG]: cleanupLossLeaderUnitFlag,
        },
      },
      export: {
        queue: 'export_queue',
        topics: {
          [EXPORT_MESSAGE_TYPE.UPLOAD_EXPORT_FILE]: handleUploadExportFile,
          [EXPORT_MESSAGE_TYPE.EXPORT_ONE_TO_MANYS]: runExportOneToManys,
          [EXPORT_MESSAGE_TYPE.SIGNED_LEASE_DOCUMENT]: exportSignedLeaseDocument,
          [EXPORT_MESSAGE_TYPE.EXPORT_TO_MRI]: exportToMri,
          [EXPORT_MESSAGE_TYPE.EXPORT_FROM_DB]: exportFromDB,
          [EXPORT_MESSAGE_TYPE.EXPORT_TO_YARDI]: exportToYardi,
        },
      },
      upload: {
        queue: 'upload_queue',
        topics: {
          [UPLOAD_MESSAGE_TYPE.UPLOAD_VOICE_MESSAGE]: uploadVoiceMessages,
          [UPLOAD_MESSAGE_TYPE.UPLOAD_DOCUMENTS]: uploadDocuments,
          [UPLOAD_MESSAGE_TYPE.DELETE_DOCUMENTS]: deleteDocuments,
          [RENTAPP_UPLOAD_MESSAGE_TYPE.UPLOAD_DOCUMENTS_RECEIVED]: handleApplicationUploadResponseReceived,
          [RENTAPP_UPLOAD_MESSAGE_TYPE.DELETE_APPLICATION_DOCUMENTS]: handleDeleteApplicationDocuments,
          [UPLOAD_MESSAGE_TYPE.UPLOAD_PUBLIC_DOCUMENTS]: uploadPublicDocuments,
        },
      },
      tasks: {
        queue: 'tasks_queue',
        topics: {
          [TASKS_MESSAGE_TYPE.PROCESS_ON_DEMAND]: processTasks,
          [TASKS_MESSAGE_TYPE.COMPLETE_ON_DEMAND]: markTasksCompleted,
          [TASKS_MESSAGE_TYPE.CANCEL_ON_DEMAND]: markTasksCanceled,
        },
        noOfConsumers: 1,
      },
      calls: {
        queue: 'calls_queue',
        topics: {
          [CALLS_QUEUE_MESSAGE_TYPE.CALL_ENQUEUED]: callEnqueued,
          [CALLS_QUEUE_MESSAGE_TYPE.CALL_READY_FOR_DEQUEUE]: callReadyForDequeue,
          [CALLS_QUEUE_MESSAGE_TYPE.CALLBACK_REQUESTED]: callbackRequested,
          [CALLS_QUEUE_MESSAGE_TYPE.VOICEMAIL_REQUESTED]: voicemailRequested,
          [CALLS_QUEUE_MESSAGE_TYPE.TRANSFER_TO_NUMBER_REQUESTED]: transferToNumberRequested,
          [CALLS_QUEUE_MESSAGE_TYPE.HANGUP]: callHungUp,
          [CALLS_QUEUE_MESSAGE_TYPE.USER_AVAILABLE]: handleUserAvailable,
          [CALLS_QUEUE_MESSAGE_TYPE.CALL_QUEUE_TIMEOUT]: callQueueTimeExpired,
          [CALLS_QUEUE_MESSAGE_TYPE.END_OF_DAY]: handleEndOfDay,
          [CALLS_QUEUE_MESSAGE_TYPE.ALL_AGENTS_OFFLINE]: handleAllAgentsOffline,
        },
        noOfConsumers: 1,
      },
      convert: {
        queue: 'convert_queue',
        topics: {
          [CONVERT_MESSAGE_TYPE.PROCESS_INPUT]: convertInputData,
        },
      },
      importUpdates: {
        queue: 'import_updates_queue',
        topics: {
          [IMPORT_UPDATES_MESSAGE_TYPE.IMPORT_FILES]: importUpdates,
        },
      },
      importCohort: {
        queue: 'import_cohort_queue',
        topics: {
          [IMPORT_COHORT_MESSAGE_TYPE.IMPORT_COHORT]: importCohortFile,
        },
      },
      party: {
        queue: 'party_queue',
        topics: {
          [PARTY_MESSAGE_TYPE.CLOSE_IMPORTED_PARTIES]: closeImportedParties,
          [PARTY_MESSAGE_TYPE.ARCHIVE_PARTIES_FROM_SOLD_PROPERTIES]: archivePartiesFromSoldProperties,
        },
      },
      lease: {
        queue: 'lease_queue',
        topics: {
          [LEASE_MESSAGE_TYPE.PUBLISH_LEASE]: publishLease,
          [LEASE_MESSAGE_TYPE.FETCH_SIGNED_LEASE]: fetchSignedLeaseDocuments,
          [LEASE_MESSAGE_TYPE.FETCH_LEASES_STATUS]: fetchLeasesStatus,
        },
      },
      jobs: {
        queue: 'jobs',
        topics: {
          [JOBS_MESSAGE_TYPE.MARK_USERS_UNAVAILABLE]: markUsersUnavailable,
          [JOBS_MESSAGE_TYPE.CHECK_INCOMING_FILES]: checkIncomingFiles,
          [JOBS_MESSAGE_TYPE.MONITOR_DATABASE]: monitorDatabase,
          [JOBS_MESSAGE_TYPE.SCREENING_MONITOR]: screeningMonitor,
          [JOBS_MESSAGE_TYPE.CLEANUP_TESTING_TENANTS]: cleanupTrainingTenants,
          [JOBS_MESSAGE_TYPE.DETACH_PROGRAM_PHONE_NUMBERS]: detachProgramPhoneNumbers,
          [JOBS_MESSAGE_TYPE.CLEANUP_PHYSICAL_ASSETS]: cleanupPhysicalAssets,
          [JOBS_MESSAGE_TYPE.VACATE_PARTY_MEMBERS]: vacatePartyMembers,
          [JOBS_MESSAGE_TYPE.PARTY_DOCUMENTS_MONITOR]: checkPartyDocuments,
          [JOBS_MESSAGE_TYPE.COMMS_MONITOR]: commsMonitor,
          [JOBS_MESSAGE_TYPE.IMPORT_AND_PROCESS_PARTY_WORKFLOWS]: importAndProcessPartyWorkflows,
          [JOBS_MESSAGE_TYPE.CLEANUP_OLD_RECORDS_FROM_BIG_TABLES]: cleanupOldRecordsFromBigTables,
          [JOBS_MESSAGE_TYPE.MRI_EXPORT_MONITOR]: handleMRIExportMonitor,
          [JOBS_MESSAGE_TYPE.ASSIGN_AL_TO_RS_TEAM]: reassignActiveLeaseToRSTeams,
          [JOBS_MESSAGE_TYPE.SYNC_BM_LEASE_SIGNATURES]: syncBMLeaseSignatures,
          [JOBS_MESSAGE_TYPE.APPLICATION_DECLINED_HANDLER]: applicationDeclinedHandler,
        },
      },
      history: {
        queue: 'party_document_history',
        topics: {
          [PARTY_MESSAGE_TYPE.DOCUMENT_HISTORY]: sendPartyDocumentHistory,
          [PARTY_MESSAGE_TYPE.RESEND_DOCUMENT_HISTORY]: resendPartyDocumentHistory,
        },
        noOfConsumers: 1,
      },
      testing: {
        queue: 'testing',
        topics: {
          load_testing: loadTestingHandler,
        },
        noOfConsumers: 4,
      },
      property: {
        queue: 'property_queue',
        topics: {
          [PROPERTY_MESSAGE_TYPE.UPDATE_POST_MONTH]: updatePostMonth,
        },
      },
      university: {
        queue: 'university_queue',
        topics: {
          [UNIVERSITY_MESSAGE_TYPE.SANDBOX_CREATION_REQUEST]: requestSandboxCreationHandler,
          [UNIVERSITY_MESSAGE_TYPE.CREATE_SANDBOX]: createSandboxHandler,
        },
      },
      externalCalendars: {
        queue: 'external_calendars_queue',
        topics: {
          [EXTERNAL_CALENDARS_TYPE.REQUEST_DELEGATED_ACCESS]: requestDelegatedAccess,
          [EXTERNAL_CALENDARS_TYPE.PERFORM_INTEGRATION_SETUP_FOR_ACCOUNT]: performIntegrationSetupForAccount,
          [EXTERNAL_CALENDARS_TYPE.USER_REVA_EVENT_UPDATED]: processUserRevaEventUpdatedNotification,
          [EXTERNAL_CALENDARS_TYPE.USER_PERSONAL_EVENT_UPDATED]: processUserPersonalEventUpdatedNotification,
          [EXTERNAL_CALENDARS_TYPE.TEAM_EVENT_UPDATED]: processTeamEventUpdatedNotification,
          [EXTERNAL_CALENDARS_TYPE.PERFORM_ACTIONS_ON_CALENDAR_ACCOUNT]: performActionsForCalendarAccount,
          [EXTERNAL_CALENDARS_TYPE.CLEANUP_CALENDAR_ACCOUNTS]: cleanupCalendarAccounts,
          [EXTERNAL_CALENDARS_TYPE.SYNC_CALENDAR_EVENTS]: syncCalendarEvents,
        },
        noOfConsumers: 1,
      },
      replication: {
        queue: 'replication_queue',
        topics: {
          [REPLICATION_MESSAGE_TYPE.REFRESH_PUBLICATION]: refreshPublication,
        },
      },
      delayedMessages: {
        queue: 'delayed_messages_queue',
        topics: {
          [DELAYED_MESSAGE_TYPE.PROCESS_DELAYED_MESSAGE]: processDelayedMessage,
          [DELAYED_MESSAGE_TYPE.DELETE_SENDGRID_TEMPLATE]: processDeleteSendGridTemplate,
          [DELAYED_MESSAGE_TYPE.DELETE_POST_RECIPIENT_RESULT_FILE]: processDeletePostRecipientResultFile,
        },
        noOfConsumers: 1,
      },
      bulkEmails: {
        queue: 'bulkEmails',
        topics: {
          [BULK_EMAILS_TYPE.SEND_BULK_EMAILS]: processAndSendBulkEmails,
        },
        noOfConsumers: 1,
      },
      rxpPayments: {
        queue: 'rxpPayments',
        topics: {
          [PAYMENT_MESSAGE_TYPE.PAYMENT_METHOD_NOTIFICATION]: handlePaymentMethodNotification,
        },
      },
    };
  },
};
