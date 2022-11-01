/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import pick from 'lodash/pick';
import sortBy from 'lodash/sortBy';
import newId from 'uuid/v4';
import { getAllRecurringJobs, getAllRecurringJobsFromAdmin } from '../../jobsRepo';
import { getAppSettings } from '../../appSettingsRepo';
import { getSubscriptions } from '../../subscriptionsRepo';
import { saveTenant } from '../../../services/tenantService';
import { setupQueueToWaitFor } from '../../../testUtils/apiHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('when creating a new tenant', () => {
  let ctx;

  before(async () => {
    const tenantId = newId();
    const newTenant = {
      id: tenantId,
      name: `testTenant${tenantId}`,
    };

    const { task } = await setupQueueToWaitFor([msg => msg.name === newTenant.name], ['sync']);
    await saveTenant({ tenantId: 'admin' }, newTenant);
    await task;

    ctx = { tenantId: newTenant.id };
  });

  describe('RecurringJobs table', () => {
    const requiredFields = ['name', 'schedule', 'timezone', 'notes', 'status'];
    const expectedData = [
      {
        name: 'ScreeningResponseValidation',
        schedule: '0 0 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every hour at minute 0',
        status: 'Idle',
      },
      {
        name: 'ExportOneToManys',
        schedule: '0 15 21 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 21:15',
        status: 'Idle',
      },
      {
        name: 'FetchLeasesStatus',
        schedule: '0 20 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every hour at minute 20',
        status: 'Idle',
      },
      {
        name: 'FetchAndStoreTransactions',
        schedule: '0 1 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every hour at minute 1',
        status: 'Idle',
      },
      {
        name: 'LongRunningScreeningRequests',
        schedule: '0 */5 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every 5 minutes',
        status: 'Idle',
      },
      {
        name: 'CallQueueEndOfDay',
        schedule: '* * * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every second',
        status: 'Idle',
      },
      {
        name: 'UpdatePostMonth',
        schedule: '0 5 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every hour at minute 5',
        status: 'Idle',
      },
      {
        name: 'TasksFollowupParty',
        schedule: '* * * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every second',
        status: 'Idle',
      },
      {
        name: 'MarkEveryoneUnavailable',
        schedule: '0 0 0 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 00:00',
        status: 'Idle',
      },
      {
        name: 'CommsMonitor',
        notes: 'Run every 30 minutes',
        schedule: '0 */30 * * * *',
        status: 'Idle',
        timezone: 'America/Los_Angeles',
      },
      {
        name: 'CheckIncomingFiles',
        schedule: '0 0 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every hour at minute 0',
        status: 'Idle',
      },
      {
        name: 'CheckForOrphanScreeningRequests',
        schedule: '0 */5 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every 5 minutes',
        status: 'Idle',
      },
      {
        name: 'ExportToYardi',
        schedule: '0 45 20 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 20:45',
        status: 'Idle',
      },
      {
        name: 'SyncExternalCalendarEvents',
        schedule: '0 30 02 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 02:30',
        status: 'Idle',
      },
      {
        name: 'ScreeningMonitor',
        notes: 'Run every day at 00:00',
        schedule: '0 0 0 * * *',
        status: 'Idle',
        timezone: 'America/Los_Angeles',
      },
      {
        name: 'DetachProgramPhoneNumbers',
        schedule: '0 30 01 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 01:30',
        status: 'Idle',
      },
      {
        name: 'VacatePartyMembers',
        schedule: '0 10 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every hour at minute 10',
        status: 'Idle',
      },
      {
        name: 'SyncBMLeaseSignatures',
        schedule: '0 */5 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every 5 minutes',
        status: 'Idle',
      },
      {
        name: DALTypes.Jobs.ApplicationDeclinedHandler,
        schedule: '0 7,19 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 07:00 and 19:00',
        status: 'Idle',
      },
      {
        name: 'PartyDocumentsMonitor',
        schedule: '0 25 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every hour at minute 25',
        status: 'Idle',
      },
      {
        name: 'ImportAndProcessPartyWorkflows',
        schedule: '0 0 01 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 01:00',
        status: 'Idle',
      },
      {
        name: 'CleanupOldRecordsFromBigTables',
        schedule: '0 15 0 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 00:15',
        status: 'Idle',
      },
      {
        name: 'MRIExportMonitor',
        schedule: '0 10 0 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 00:10',
        status: 'Idle',
      },
      {
        name: 'AssignActiveLeaseToRSTeams',
        schedule: '0 45 01 * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every day at 01:45',
        status: 'Idle',
      },
    ];

    it('should contain all required records', async () => {
      const recurringJobs = await getAllRecurringJobs(ctx);
      const filteredData = recurringJobs.map(job => pick(job, requiredFields));
      expect(sortBy(filteredData, 'name')).to.deep.equal(sortBy(expectedData, 'name'));
    });
  });

  describe('AppSettings table', () => {
    const requiredFields = ['category', 'description', 'datatype', 'key', 'value'];
    const expectedData = [
      {
        category: 'Email',
        description: 'When an appointment is canceled send email to required residents',
        datatype: 'Bool',
        key: 'SendAppointmentCanceledEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When an appointment is created send email to required residents',
        datatype: 'Bool',
        key: 'SendAppointmentCreatedEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When an appointment is updated send email to required residents',
        datatype: 'Bool',
        key: 'SendAppointmentUpdatedEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When a lease is executed send an email to all residents included on the lease',
        datatype: 'Bool',
        key: 'SendLeaseExecutedEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When a lease is sent send email to all residents who will not sign in the office',
        datatype: 'Bool',
        key: 'SendLeaseSentEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When a lease is voided send email to all residents who received or signed the lease',
        datatype: 'Bool',
        key: 'SendLeaseVoidedEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When an application payment is confirmed, send an email to the resident to complete the registration',
        datatype: 'Bool',
        key: 'SendRegistrationEmail',
        value: 'true',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when the payment for an application is completed',
        datatype: 'Text',
        key: 'ApplicationCompleteRegistrationEmailTemplate',
        value: 'application-complete-registration',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when sending emails on contract executed',
        datatype: 'Text',
        key: 'ContractExecutedEmailTemplate',
        value: 'contract-executed',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when sending emails on contract sent',
        datatype: 'Text',
        key: 'ContractSentEmailTemplate',
        value: 'contract-sent',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when sending emails on contract voided',
        datatype: 'Text',
        key: 'ContractVoidedEmailTemplate',
        value: 'contract-voided',
      },
      {
        category: 'SMS',
        description: 'When an appointment is canceled send SMS to required residents',
        datatype: 'Bool',
        key: 'SendAppointmentCanceledSMS',
        value: 'true',
      },
      {
        category: 'SMS',
        description: 'When an appointment is created send SMS to required residents',
        datatype: 'Bool',
        key: 'SendAppointmentCreatedSMS',
        value: 'true',
      },
      {
        category: 'SMS',
        description: 'When an appointment is updated send SMS to required residents',
        datatype: 'Bool',
        key: 'SendAppointmentUpdatedSMS',
        value: 'true',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when sending an quote email',
        datatype: 'Text',
        key: 'QuoteSentEmailTemplate',
        value: 'application-a2r-invite-quote',
      },
      {
        category: 'Email',
        description: 'When a quote is published, send email to all partyMembers with the quote',
        datatype: 'Bool',
        key: 'SendQuoteEmail',
        value: 'true',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when a resident is sending an application invite email to a guarantor and a quote is published',
        datatype: 'Text',
        key: 'ResidentToGuarantorQuoteTemplate',
        value: 'application-r2g-invite-quote',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when a resident is sending an application invite email to a resident and a quote is published',
        datatype: 'Text',
        key: 'ResidentToResidetQuoteTemplate',
        value: 'application-r2r-invite-quote',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when an occupant is sending an application invite email to a resident and a quote is published',
        datatype: 'Text',
        key: 'OccupantToResidentQuoteTemplate',
        value: 'application-o2r-invite-quote',
      },
      {
        category: 'EmailTemplate',
        description: 'The name of the template to use when sending a renewal letter',
        datatype: 'Text',
        key: 'RenewalLetterEmailTemplate',
        value: 'renewal-a2r-summary-quote',
      },
      {
        category: 'Email',
        description: 'When payment is received, send email to the invited guarantor from application form phase 1',
        datatype: 'Bool',
        key: 'SendResidentToGuarantorApplicationInviteEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When payment is received, send email to all invited residents from application form phase 1',
        datatype: 'Bool',
        key: 'SendResidentToResidentApplicationInviteEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When payment is received, send email to all invited residents from application form phase 1',
        datatype: 'Bool',
        key: 'SendOccupantToResidentApplicationInviteEmail',
        value: 'true',
      },
      {
        category: 'Email',
        description: 'When a renewal letter is published, send email to all partyMembers with the letter',
        datatype: 'Bool',
        key: 'SendRenewalLetterEmail',
        value: 'true',
      },
    ];

    it('should contain all required records', async () => {
      const appSettings = await getAppSettings(ctx);
      const filteredData = appSettings.map(job => pick(job, requiredFields));

      expect(sortBy(filteredData, 'key')).to.deep.equal(sortBy(expectedData, 'key'));
    });
  });

  describe('Subscriptions table', () => {
    const requiredFields = ['decision_name', 'url', 'activeForEvents'];
    const expectedData = [
      {
        decision_name: 'export',
        url: '/v1/export',
        activeForEvents: [
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.APPOINTMENT_COMPLETED,
          DALTypes.PartyEventType.PARTY_MERGED,
          DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED,
          DALTypes.PartyEventType.APPLICATION_TRANSACTION_UPDATED,
          DALTypes.PartyEventType.LEASE_EXECUTED,
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.PARTY_REASSIGNED_PROPERTY,
          DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED,
          DALTypes.PartyEventType.LEASE_SIGNED,
          DALTypes.PartyEventType.LEASE_VERSION_CREATED,
          DALTypes.PartyEventType.UNIT_HELD,
          DALTypes.PartyEventType.UNIT_RELEASED,
        ],
      },
      {
        decision_name: 'party:reassign',
        url: '/v1/party/reassign',
        activeForEvents: [DALTypes.PartyEventType.PARTY_TEAM_REASSIGNED],
      },
      {
        decision_name: 'party:scoring',
        url: '/v1/party/scoring',
        activeForEvents: [
          DALTypes.PartyEventType.PARTY_CREATED,
          DALTypes.PartyEventType.APPOINTMENT_CREATED,
          DALTypes.PartyEventType.APPOINTMENT_UPDATED,
          DALTypes.PartyEventType.APPOINTMENT_COMPLETED,
          DALTypes.PartyEventType.COMMUNICATION_RECEIVED,
          DALTypes.PartyEventType.COMMUNICATION_ADDED,
        ],
      },
      {
        decision_name: 'task:complete_contact_info',
        url: '/v1/tasks/completeContactInfo',
        activeForEvents: [
          DALTypes.PartyEventType.PERSON_UPDATED,
          DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          DALTypes.PartyEventType.CONTACT_INFO_REMOVED,
          DALTypes.PartyEventType.PARTY_MEMBER_ADDED,
          DALTypes.PartyEventType.PARTY_MEMBER_REMOVED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.LEASE_RENEWAL_CREATED,
        ],
      },
      {
        decision_name: 'task:counter_sign',
        url: '/v1/tasks/counterSign',
        activeForEvents: [
          DALTypes.PartyEventType.LEASE_SIGNED,
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.LEASE_COUNTERSIGNED,
          DALTypes.PartyEventType.LEASE_VERSION_CREATED,
          DALTypes.PartyEventType.LEASE_EXECUTED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
      {
        decision_name: 'task:introduce_yourself',
        url: '/v1/tasks/introduceYourself',
        activeForEvents: [
          DALTypes.PartyEventType.COMMUNICATION_RECEIVED,
          DALTypes.PartyEventType.COMMUNICATION_SENT,
          DALTypes.PartyEventType.COMMUNICATION_ADDED,
          DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL,
          DALTypes.PartyEventType.COMMUNICATION_ANSWERED_CALL,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
      {
        decision_name: 'task:contact_back',
        url: '/v1/tasks/contactBack',
        activeForEvents: [
          DALTypes.PartyEventType.COMMUNICATION_MISSED_CALL,
          DALTypes.PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED,
          DALTypes.PartyEventType.COMMUNICATION_ADDED,
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.LEASE_COUNTERSIGNED,
          DALTypes.PartyEventType.TASK_ADDED,
          DALTypes.PartyEventType.COMMUNICATION_ANSWERED_CALL,
          DALTypes.PartyEventType.COMMUNICATION_SENT,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
      {
        decision_name: 'email:lease',
        url: '/v1/email/lease',
        activeForEvents: [
          DALTypes.PartyEventType.LEASE_VERSION_CREATED,
          DALTypes.PartyEventType.LEASE_EXECUTED,
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.LEASE_SENT,
        ],
      },
      {
        decision_name: 'email:appointment',
        url: '/v1/email/appointment',
        activeForEvents: [
          DALTypes.PartyEventType.APPOINTMENT_CREATED,
          DALTypes.PartyEventType.APPOINTMENT_UPDATED,
          DALTypes.PartyEventType.APPOINTMENT_CANCELED,
        ],
      },
      {
        decision_name: 'email:registration',
        url: '/v1/email/registration',
        activeForEvents: [DALTypes.PartyEventType.PAYMENT_RECEIVED],
      },
      {
        decision_name: 'email:residents_invite',
        url: '/v1/email/residentsInvite',
        activeForEvents: [DALTypes.PartyEventType.LEASE_SIGNED, DALTypes.PartyEventType.PARTY_CREATED],
      },
      {
        decision_name: 'email:applicationDeclined',
        url: '/v1/email/applicationDeclined',
        activeForEvents: [DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED],
      },
      {
        decision_name: 'task:removeAnonymousEmail',
        url: '/v1/tasks/removeAnonymousEmail',
        activeForEvents: [
          DALTypes.PartyEventType.PARTY_MEMBER_ADDED,
          DALTypes.PartyEventType.PARTY_MEMBER_UPDATED,
          DALTypes.PartyEventType.PARTY_MEMBER_REMOVED,
          DALTypes.PartyEventType.PERSON_UPDATED,
          DALTypes.PartyEventType.PARTY_UPDATED,
          DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          DALTypes.PartyEventType.CONTACT_INFO_REMOVED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
          DALTypes.PartyEventType.PARTY_CLOSED,
        ],
      },
      {
        decision_name: 'party:screening',
        url: '/v1/party/screening',
        activeForEvents: [
          DALTypes.PartyEventType.QUOTE_PUBLISHED,
          DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED,
          DALTypes.PartyEventType.APPLICANT_REPORT_STATUS_UPDATED,
          DALTypes.PartyEventType.PARTY_MEMBER_ADDED,
          DALTypes.PartyEventType.PARTY_MEMBER_REMOVED,
          DALTypes.PartyEventType.PARTY_MEMBER_LINKED,
          DALTypes.PartyEventType.PARTY_MEMBER_TYPE_UPDATED,
        ],
      },
      {
        decision_name: 'email:quote',
        url: '/v1/email/quote',
        activeForEvents: [DALTypes.PartyEventType.QUOTE_SENT],
      },
      {
        decision_name: 'email:person_application_invite',
        url: '/v1/email/personApplicationInvite',
        activeForEvents: [DALTypes.PartyEventType.PERSON_TO_PERSON_APPLICATION_INVITE],
      },
      {
        decision_name: 'task:promote_application',
        url: '/v1/tasks/promoteApplication',
        activeForEvents: [
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.PERSONS_MERGED,
          DALTypes.PartyEventType.PERSONS_APPLICATION_MERGED,
          DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED,
          DALTypes.PartyEventType.SCREENING_RESPONSE_PROCESSED,
          DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED,
          DALTypes.PartyEventType.PARTY_MEMBER_ADDED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
          DALTypes.PartyEventType.PARTY_UPDATED,
        ],
      },
      {
        decision_name: 'task:send_contract',
        url: '/v1/tasks/sendContract',
        activeForEvents: [
          DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED,
          DALTypes.PartyEventType.LEASE_SENT,
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.LEASE_SIGNED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
      {
        decision_name: 'task:review_application',
        url: '/v1/tasks/reviewApplication',
        activeForEvents: [
          DALTypes.PartyEventType.QUOTE_PROMOTION_UPDATED,
          DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED,
          DALTypes.PartyEventType.DEMOTE_APPLICATION,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
      {
        decision_name: 'task:send_renewal_quote',
        url: '/v1/tasks/sendRenewalQuote',
        activeForEvents: [
          DALTypes.PartyEventType.LEASE_RENEWAL_CREATED,
          DALTypes.PartyEventType.LEASE_RENEWAL_MOVING_OUT,
          DALTypes.PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT,
          DALTypes.PartyEventType.QUOTE_PUBLISHED,
          DALTypes.PartyEventType.LEASE_CREATED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
          DALTypes.PartyEventType.COMMUNICATION_ADDED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.QUOTE_PRINTED,
        ],
      },
      {
        decision_name: 'task:send_renewal_reminder',
        url: '/v1/tasks/sendRenewalReminder',
        activeForEvents: [
          DALTypes.PartyEventType.LEASE_RENEWAL_MOVING_OUT,
          DALTypes.PartyEventType.COMMUNICATION_SENT,
          DALTypes.PartyEventType.COMMUNICATION_ADDED,
          DALTypes.PartyEventType.QUOTE_SENT,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
      {
        decision_name: 'task:collect_emergency_contact',
        url: '/v1/tasks/collectEmergencyContact',
        activeForEvents: [
          DALTypes.PartyEventType.LEASE_EXECUTED,
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
      {
        decision_name: 'corticon',
        url: '/v1/corticon/request',
        activeForEvents: [
          DALTypes.PartyEventType.COMMUNICATION_COMPLETED,
          DALTypes.PartyEventType.TASK_ADDED,
          DALTypes.PartyEventType.TASK_UPDATED,
          DALTypes.PartyEventType.CUSTOM_MESSAGE,
          DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
          DALTypes.PartyEventType.PARTY_UPDATED,
          DALTypes.PartyEventType.LEASE_COUNTERSIGNED,
          DALTypes.PartyEventType.LEASE_VOIDED,
          DALTypes.PartyEventType.LEASE_RENEWAL_CREATED,
          DALTypes.PartyEventType.LEASE_PUBLISHED,
          DALTypes.PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT,
          DALTypes.PartyEventType.LEASE_RENEWAL_MOVING_OUT,
          DALTypes.PartyEventType.LEASE_CREATED,
          DALTypes.PartyEventType.CONTACT_INFO_REMOVED,
          DALTypes.PartyEventType.PARTY_MEMBER_ADDED,
          DALTypes.PartyEventType.PARTY_MEMBER_REMOVED,
          DALTypes.PartyEventType.CONTACT_INFO_ADDED,
          DALTypes.PartyEventType.PERSON_UPDATED,
          DALTypes.PartyEventType.QUOTE_PRINTED,
        ],
      },
      {
        decision_name: 'task:collect_service_animal_doc',
        url: '/v1/tasks/collectServiceAnimalDoc',
        activeForEvents: [
          DALTypes.PartyEventType.SERVICE_ANIMAL_ADDED,
          DALTypes.PartyEventType.ALL_SERVICE_ANIMALS_REMOVED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
          DALTypes.PartyEventType.PARTY_REOPENED,
        ],
      },
      {
        decision_name: 'task:contact_party_declined_decision',
        url: '/v1/tasks/contactPartyDeclinedDecision',
        activeForEvents: [
          DALTypes.PartyEventType.APPLICATION_STATUS_UPDATED,
          DALTypes.PartyEventType.PARTY_REOPENED,
          DALTypes.PartyEventType.PARTY_CLOSED,
          DALTypes.PartyEventType.PARTY_ARCHIVED,
        ],
      },
    ];

    it('should contain all required records', async () => {
      const subscriptions = await getSubscriptions(ctx);
      const filteredData = subscriptions.map(job => pick(job, requiredFields));

      expect(sortBy(filteredData, 'decision_name')).to.deep.equal(sortBy(expectedData, 'decision_name'));
    });
  });
});

describe('the admin schema', () => {
  let ctx;

  before(async () => {
    const tenantId = newId();
    const newTenant = {
      id: tenantId,
      name: `testTenant${tenantId}`,
    };

    ctx = { tenantId: newTenant.id };
  });

  describe('RecurringJobs table ', () => {
    const requiredFields = ['name', 'schedule', 'timezone', 'notes', 'status'];
    const expectedData = [
      {
        name: 'MonitorDatabase',
        schedule: '0 */5 * * * *',
        timezone: 'America/Los_Angeles',
        notes: 'Run every 5 minutes',
        status: 'Idle',
      },
      {
        name: 'CleanupTestingTenants',
        schedule: '0 30 6 * * 6',
        timezone: 'America/Los_Angeles',
        notes: 'Run each Saturday at 6.30AM',
        status: 'Idle',
      },
      {
        name: 'CleanupPhysicalAssets',
        schedule: '0 0 23 * * 0',
        timezone: 'America/Los_Angeles',
        notes: 'Run each Sunday at 11:00PM',
        status: 'Idle',
      },
    ];

    it('should contain all required records', async () => {
      const recurringJobs = await getAllRecurringJobsFromAdmin(ctx);
      const filteredData = recurringJobs.map(job => pick(job, requiredFields));
      expect(sortBy(filteredData, 'name')).to.deep.equal(sortBy(expectedData, 'name'));
    });
  });
});
