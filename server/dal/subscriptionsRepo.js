/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { initQuery, knex, runInTransaction, rawStatement } from '../database/factory';
import logger from '../../common/helpers/logger';
import { DALTypes } from '../../common/enums/DALTypes';
import { prepareRawQuery } from '../common/schemaConstants';
import { createJWTToken } from '../../common/server/jwt-helpers';
import config from '../config';
import { corticonEvents } from '../../common/server/subscriptions';
import { disableRecurringJobsWithMigrationsTransactionByName } from './jobsRepo';
import { getTenant } from '../services/tenantService';
import { isUuid } from '../common/utils';
import { now } from '../../common/helpers/moment-utils';

const { PartyEventType } = DALTypes;
const tokenExpirationPeriod = '100y';

const buildSQLArrayFromJS = elements => `{${elements.join(',')}}`;

const exportEvents = [
  PartyEventType.PARTY_CLOSED,
  PartyEventType.APPOINTMENT_COMPLETED,
  PartyEventType.PARTY_MERGED,
  PartyEventType.APPLICATION_STATUS_UPDATED,
  PartyEventType.APPLICATION_TRANSACTION_UPDATED,
  PartyEventType.LEASE_EXECUTED,
  PartyEventType.LEASE_VOIDED,
  PartyEventType.PARTY_REASSIGNED_PROPERTY,
  PartyEventType.APPLICATION_PAYMENT_PROCESSED,
  PartyEventType.LEASE_SIGNED,
  PartyEventType.LEASE_VERSION_CREATED,
  PartyEventType.UNIT_HELD,
  PartyEventType.UNIT_RELEASED,
];

const completeContactInfoEvents = [
  PartyEventType.PERSON_UPDATED,
  PartyEventType.CONTACT_INFO_ADDED,
  PartyEventType.CONTACT_INFO_REMOVED,
  PartyEventType.PARTY_MEMBER_ADDED,
  PartyEventType.PARTY_MEMBER_REMOVED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.LEASE_RENEWAL_CREATED,
];

const removeAnonymousEmailEvents = [
  PartyEventType.PARTY_MEMBER_ADDED,
  PartyEventType.PARTY_MEMBER_UPDATED,
  PartyEventType.PARTY_MEMBER_REMOVED,
  PartyEventType.PERSON_UPDATED,
  PartyEventType.PARTY_UPDATED,
  PartyEventType.CONTACT_INFO_ADDED,
  PartyEventType.CONTACT_INFO_REMOVED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.PARTY_CLOSED,
];

const countersignEvents = [
  PartyEventType.LEASE_SIGNED,
  PartyEventType.LEASE_VOIDED,
  PartyEventType.LEASE_COUNTERSIGNED,
  PartyEventType.LEASE_VERSION_CREATED,
  PartyEventType.LEASE_EXECUTED,
  PartyEventType.PARTY_ARCHIVED,
];

const introduceYourselfEvents = [
  PartyEventType.COMMUNICATION_RECEIVED,
  PartyEventType.COMMUNICATION_SENT,
  PartyEventType.COMMUNICATION_ADDED,
  PartyEventType.COMMUNICATION_MISSED_CALL,
  PartyEventType.COMMUNICATION_ANSWERED_CALL,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
];

const sendLeaseEmailEvents = [PartyEventType.LEASE_VERSION_CREATED, PartyEventType.LEASE_EXECUTED, PartyEventType.LEASE_VOIDED, PartyEventType.LEASE_SENT];
const sendAppointmentEmailEvents = [PartyEventType.APPOINTMENT_CREATED, PartyEventType.APPOINTMENT_UPDATED, PartyEventType.APPOINTMENT_CANCELED];
const sendRegistrationEmailEvents = [PartyEventType.PAYMENT_RECEIVED];
const sendApplicationDeclinedEmailEvents = [PartyEventType.APPLICATION_STATUS_UPDATED];
const partyScoringEvents = [
  PartyEventType.PARTY_CREATED,
  PartyEventType.APPOINTMENT_CREATED,
  PartyEventType.APPOINTMENT_UPDATED,
  PartyEventType.APPOINTMENT_COMPLETED,
  PartyEventType.COMMUNICATION_RECEIVED,
  PartyEventType.COMMUNICATION_ADDED,
];
const contactBackEvents = [
  PartyEventType.COMMUNICATION_MISSED_CALL,
  PartyEventType.COMMUNICATION_CALL_BACK_REQUESTED,
  PartyEventType.COMMUNICATION_ADDED,
  PartyEventType.LEASE_VOIDED,
  PartyEventType.LEASE_COUNTERSIGNED,
  PartyEventType.TASK_ADDED,
  PartyEventType.COMMUNICATION_ANSWERED_CALL,
  PartyEventType.COMMUNICATION_SENT,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
];

const screeningEvents = [
  PartyEventType.QUOTE_PUBLISHED,
  PartyEventType.APPLICATION_STATUS_UPDATED,
  PartyEventType.APPLICANT_REPORT_STATUS_UPDATED,
  PartyEventType.PARTY_MEMBER_ADDED,
  PartyEventType.PARTY_MEMBER_REMOVED,
  PartyEventType.PARTY_MEMBER_LINKED,
  PartyEventType.PARTY_MEMBER_TYPE_UPDATED,
];

const promoteApplicationEvents = [
  PartyEventType.LEASE_VOIDED,
  PartyEventType.PERSONS_MERGED,
  PartyEventType.PERSONS_APPLICATION_MERGED,
  PartyEventType.APPLICATION_STATUS_UPDATED,
  PartyEventType.SCREENING_RESPONSE_PROCESSED,
  PartyEventType.QUOTE_PROMOTION_UPDATED,
  PartyEventType.PARTY_MEMBER_ADDED,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.PARTY_UPDATED,
];

const reviewApplicationEvents = [
  PartyEventType.QUOTE_PROMOTION_UPDATED,
  PartyEventType.APPLICATION_STATUS_UPDATED,
  PartyEventType.DEMOTE_APPLICATION,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
];

const sendContractEvents = [
  PartyEventType.QUOTE_PROMOTION_UPDATED,
  PartyEventType.LEASE_SENT,
  PartyEventType.LEASE_VOIDED,
  PartyEventType.LEASE_SIGNED,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
];

const sendQuoteEmailEvents = [PartyEventType.QUOTE_SENT];

// TODO this can be removed after the migration files are colapsed
const migrateMoveInDocumentsEvents = [PartyEventType.LEASE_VOIDED, PartyEventType.LEASE_EXECUTED, PartyEventType.PARTY_ARCHIVED];

const personApplicationInviteEvents = [PartyEventType.PERSON_TO_PERSON_APPLICATION_INVITE];

const sendRenewalQuoteEvents = [
  PartyEventType.LEASE_RENEWAL_CREATED,
  PartyEventType.LEASE_RENEWAL_MOVING_OUT,
  PartyEventType.LEASE_RENEWAL_CANCEL_MOVE_OUT,
  PartyEventType.QUOTE_PUBLISHED,
  PartyEventType.LEASE_CREATED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.COMMUNICATION_ADDED,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.QUOTE_PRINTED,
];

const sendRenewalReminderEvents = [
  PartyEventType.LEASE_RENEWAL_MOVING_OUT,
  PartyEventType.COMMUNICATION_SENT,
  PartyEventType.COMMUNICATION_ADDED,
  PartyEventType.QUOTE_SENT,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
];

const sendResidentsInviteEvents = [PartyEventType.LEASE_SIGNED, PartyEventType.PARTY_CREATED];

const customMessageEvents = [PartyEventType.CUSTOM_MESSAGE];

const createPartyMemberEvents = [PartyEventType.PARTY_CREATED, PartyEventType.PARTY_STATE_CHANGED];

const reassignPartyFromInactiveTeamEvents = [PartyEventType.PARTY_TEAM_REASSIGNED];

const collectServiceAnimalDocEvents = [
  PartyEventType.SERVICE_ANIMAL_ADDED,
  PartyEventType.ALL_SERVICE_ANIMALS_REMOVED,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
  PartyEventType.PARTY_REOPENED,
];

const collectEmergencyContactEvents = [PartyEventType.LEASE_EXECUTED, PartyEventType.LEASE_VOIDED, PartyEventType.PARTY_CLOSED, PartyEventType.PARTY_ARCHIVED];

const contactPartyDeclinedDecisionEvents = [
  PartyEventType.APPLICATION_STATUS_UPDATED,
  PartyEventType.PARTY_REOPENED,
  PartyEventType.PARTY_CLOSED,
  PartyEventType.PARTY_ARCHIVED,
];

export const getSubscriptions = async ctx => {
  logger.debug({ ctx }, 'getSubscriptions');
  return await initQuery(ctx).from('Subscriptions');
};

export const getMatchingSubscriptions = async (ctx, eventNames, inactive = false) => {
  logger.debug({ ctx, eventNames }, 'getMatchingSubscriptions');
  const inactiveFilter = !inactive ? 'AND "inactiveSince" IS NULL' : 'AND "inactiveSince" IS NOT NULL';
  const command = knex
    .raw(
      prepareRawQuery(
        `SELECT * from db_namespace."Subscriptions"
         WHERE ("activeForEvents" && :event_names OR "activeForEvents" = '{*}')
         ${inactiveFilter}
        `,
        ctx.tenantId,
      ),
      { event_names: buildSQLArrayFromJS(eventNames) },
    )
    .toString();
  const { rows } = await knex.raw(command);
  return rows || [];
};

export const getSubscriptionByName = async (ctx, name) => {
  logger.debug({ ctx, name }, 'getSubscriptionByName');
  return await initQuery(ctx).from('Subscriptions').where({ decision_name: name }).first();
};

const saveDefaultSubscriptions = async (conn, { tenantId, trx }) => {
  const token = createJWTToken({ tenantId }, { expiresIn: tokenExpirationPeriod });
  const active = 'null';
  const inactive = 'now()';
  const command = prepareRawQuery(
    `
      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'party:scoring', '${config.decisionApiUrl}/v1/party/scoring', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:complete_contact_info', '${config.decisionApiUrl}/v1/tasks/completeContactInfo', '${token}', now(), now(), ${inactive});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:removeAnonymousEmail', '${config.decisionApiUrl}/v1/tasks/removeAnonymousEmail', '${token}', now(), now(), ${inactive});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:counter_sign', '${config.decisionApiUrl}/v1/tasks/counterSign', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:introduce_yourself', '${config.decisionApiUrl}/v1/tasks/introduceYourself', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:review_application', '${config.decisionApiUrl}/v1/tasks/reviewApplication', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:contact_back', '${config.decisionApiUrl}/v1/tasks/contactBack', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'export', '${config.exportApiUrl}/v1/export', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'email:lease', '${config.decisionApiUrl}/v1/email/lease', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'email:appointment', '${config.decisionApiUrl}/v1/email/appointment', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'email:registration', '${config.decisionApiUrl}/v1/email/registration', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'email:applicationDeclined', '${config.decisionApiUrl}/v1/email/applicationDeclined', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'party:screening', '${config.decisionApiUrl}/v1/party/screening', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'email:quote', '${config.decisionApiUrl}/v1/email/quote', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'email:person_application_invite', '${config.decisionApiUrl}/v1/email/personApplicationInvite', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'email:residents_invite', '${config.decisionApiUrl}/v1/email/residentsInvite', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:promote_application', '${config.decisionApiUrl}/v1/tasks/promoteApplication', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:send_contract', '${config.decisionApiUrl}/v1/tasks/sendContract', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:send_renewal_quote', '${config.decisionApiUrl}/v1/tasks/sendRenewalQuote', '${token}', now(), now(), ${inactive});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:send_renewal_reminder', '${config.decisionApiUrl}/v1/tasks/sendRenewalReminder', '${token}', now(), now(), ${inactive});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'corticon', '${config.decisionApiUrl}/v1/corticon/request', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'party:reassign', '${config.decisionApiUrl}/v1/party/reassign', '${token}', now(), now(), ${active});
      
      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:collect_service_animal_doc', '${config.decisionApiUrl}/v1/tasks/collectServiceAnimalDoc', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:collect_emergency_contact', '${config.decisionApiUrl}/v1/tasks/collectEmergencyContact', '${token}', now(), now(), ${active});

      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, auth_token, created_at, updated_at, "inactiveSince")
      VALUES("public".gen_random_uuid(), 'task:contact_party_declined_decision', '${config.decisionApiUrl}/v1/tasks/contactPartyDeclinedDecision', '${token}', now(), now(), ${active});

      `,
    tenantId,
  );
  await conn.raw(command).transacting(trx || conn);
};

const insertSubscription = async (conn, { tenantId, trx }, name, events, url) => {
  const token = createJWTToken({ tenantId }, { expiresIn: tokenExpirationPeriod });
  const command = prepareRawQuery(
    `
      INSERT INTO db_namespace."Subscriptions"
      (id, decision_name, url, "activeForEvents", auth_token, created_at, updated_at)
      VALUES("public".gen_random_uuid(), :name, :url, :events, '${token}', now(), now()) ON CONFLICT(decision_name) DO NOTHING;
      `,
    tenantId,
  );
  await conn.raw(command, { name, events, url }).transacting(trx || conn);
};

const updateSubscriptionEvents = async (conn, { tenantId, trx }, name, events) => {
  const token = createJWTToken({ tenantId }, { expiresIn: tokenExpirationPeriod });
  await conn
    .withSchema(tenantId)
    .from('Subscriptions')
    .where({ decision_name: name })
    .update({
      activeForEvents: events,
      auth_token: token,
    })
    .transacting(trx || conn);
};

export const updateExportSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'export', exportEvents);
export const updateScoringSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'party:scoring', partyScoringEvents);
export const updateCountersignSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'task:counter_sign', countersignEvents);

export const updateCompleteContactInfoSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:complete_contact_info', completeContactInfoEvents);
export const updateRemoveAnonymousEmailSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:removeAnonymousEmail', removeAnonymousEmailEvents);

const updateIntroduceYourselfSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'task:introduce_yourself', introduceYourselfEvents);
export const updateSendLeaseEmailSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'email:lease', sendLeaseEmailEvents);
export const updateSendAppointmentEmailSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'email:appointment', sendAppointmentEmailEvents);
export const updateSendRegistrationEmailSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'email:registration', sendRegistrationEmailEvents);
export const updateSendApplicationStatusUpdatedEmailSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'email:applicationDeclined', sendApplicationDeclinedEmailEvents);

export const updateContactBackSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'task:contact_back', contactBackEvents);

const updateScreeningSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'party:screening', screeningEvents);

export const updateSendQuoteEmailSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'email:quote', sendQuoteEmailEvents);

const updatePersonApplicationInviteSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'email:person_application_invite', personApplicationInviteEvents);

export const updatePromoteApplicationTaskSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:promote_application', promoteApplicationEvents);

const updateReviewApplicationTaskSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:review_application', reviewApplicationEvents);

const updateSendContractTaskSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'task:send_contract', sendContractEvents);

export const updateSendRenewalQuoteSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:send_renewal_quote', sendRenewalQuoteEvents);

export const updateSendRenewalReminderSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:send_renewal_reminder', sendRenewalReminderEvents);

const updateSendResidentsInviteSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'email:residents_invite', sendResidentsInviteEvents);

export const updateCustomMessagesSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'party:customMessages', customMessageEvents);

export const updateCollectServiceAnimalDocSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:collect_service_animal_doc', collectServiceAnimalDocEvents);

export const updateSubscriptionState = async (conn, ctx, decisionServices, inactiveSince) => {
  const { trx, tenantId } = ctx;
  const query = prepareRawQuery(
    'UPDATE db_namespace."Subscriptions" SET "inactiveSince" = :inactiveSince WHERE decision_name = ANY(:decisionServices)',
    tenantId,
  );
  await conn.raw(query, { inactiveSince, decisionServices }).transacting(trx || conn);
};

export const updateCorticonSubscription = async (conn, ctx) => await updateSubscriptionEvents(conn, ctx, 'corticon', corticonEvents);

const updateReassignPartiesFromInactiveTeamSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'party:reassign', reassignPartyFromInactiveTeamEvents);

const updateCollectEmergencyContactSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:collect_emergency_contact', collectEmergencyContactEvents);

const updateContactPartyDeclinedDecisionSubscription = async (conn, ctx) =>
  await updateSubscriptionEvents(conn, ctx, 'task:contact_party_declined_decision', contactPartyDeclinedDecisionEvents);

export const disableRecurringJobEvents = async (conn, ctx) =>
  await disableRecurringJobsWithMigrationsTransactionByName(conn, ctx, [DALTypes.Jobs.TasksFollowupParty]);

export const insertScreeningSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'party:screening', screeningEvents, `${config.decisionApiUrl}/v1/party/screening`);

export const insertQuoteEmailSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'email:quote', sendQuoteEmailEvents, `${config.decisionApiUrl}/v1/email/quote`);

export const insertPersonApplicationInviteSubscription = async (conn, ctx) =>
  await insertSubscription(
    conn,
    ctx,
    'email:person_application_invite',
    personApplicationInviteEvents,
    `${config.decisionApiUrl}/v1/email/personApplicationInvite`,
  );

export const insertPromoteApplicationTaskSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'task:promote_application', promoteApplicationEvents, `${config.decisionApiUrl}/v1/tasks/promoteApplication`);

export const insertSendContractTaskSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'task:send_contract', sendContractEvents, `${config.decisionApiUrl}/v1/tasks/sendContract`);

// TODO this can be removed after the migration files are colapsed
export const insertMigrateMoveInDocumentsTaskSubscription = async (conn, ctx) =>
  await insertSubscription(
    conn,
    ctx,
    'task:migrate_move_in_documents',
    migrateMoveInDocumentsEvents,
    `${config.decisionApiUrl}/v1/tasks/migrateMoveInDocuments`,
  );

export const insertSendRenewalQuoteSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'task:send_renewal_quote', sendRenewalQuoteEvents, `${config.decisionApiUrl}/v1/tasks/sendRenewalQuote`);

export const insertSendRenewalReminderSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'task:send_renewal_reminder', sendRenewalReminderEvents, `${config.decisionApiUrl}/v1/tasks/sendRenewalReminder`);

export const insertHandleCAIPartySubscription = async (conn, ctx) => {
  config.isDemoEnv &&
    (await insertSubscription(conn, ctx, 'party:handle_cai', [PartyEventType.COMMUNICATION_COMPLETED], `${config.decisionApiUrl}/v1/party/handleCai`));
};

export const insertCustomMessagesSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'party:customMessages', customMessageEvents, `${config.decisionApiUrl}/v1/party/customMessages`);

export const insertCorticonSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'corticon', [], `${config.decisionApiUrl}/v1/corticon/request`);

export const insertSendResidentsInviteSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'email:residents_invite', sendResidentsInviteEvents, `${config.decisionApiUrl}/v1/email/residentsInvite`);

const insertPartyCreatePartyMemberSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'party:partyMember', createPartyMemberEvents, `${config.decisionApiUrl}/v1/party/partyMember`);

export const insertReassignPartiesFromInactiveTeamSubscription = async (conn, ctx) =>
  await insertSubscription(conn, ctx, 'party:reassign', reassignPartyFromInactiveTeamEvents, `${config.decisionApiUrl}/v1/party/reassign`);

export const insertCollectEmergencyContactSubscription = async (conn, ctx) =>
  await insertSubscription(
    conn,
    ctx,
    'task:collect_emergency_contact',
    collectEmergencyContactEvents,
    `${config.decisionApiUrl}/v1/tasks/collectEmergencyContact`,
  );

export const insertContactPartyDeclinedDecisionSubscription = async (conn, ctx) =>
  await insertSubscription(
    conn,
    ctx,
    'task:contact_party_declined_decision',
    contactPartyDeclinedDecisionEvents,
    `${config.decisionApiUrl}/v1/tasks/contactPartyDeclinedDecision`,
  );

export const shouldProcessPartyCreatePartyMemberSubscription = async (ctx, tenant) => {
  const tenantData = tenant ?? (await getTenant(ctx));
  const { metadata: { backendIntegration, paymentProviderMode: tenantPaymentProviderMode } = {} } = tenantData || {};

  const backendMode = backendIntegration?.name ?? DALTypes.BackendMode.NONE;
  const paymentProviderMode = tenantPaymentProviderMode ?? DALTypes.PaymentProviderMode.FAKE;

  return backendMode === DALTypes.BackendMode.NONE && paymentProviderMode === DALTypes.PaymentProviderMode.REAL_TEST;
};

export const updateCreatePartyMemberSubscription = async (conn, ctx) => {
  const { tenantId } = ctx;
  if (!isUuid(tenantId)) return;
  (await shouldProcessPartyCreatePartyMemberSubscription(ctx)) && (await insertPartyCreatePartyMemberSubscription(conn, ctx));
};

export const deleteExistingSubscriptions = async (conn, { tenantId, trx }) =>
  await conn
    .withSchema(tenantId)
    .from('Subscriptions')
    .del()
    .transacting(trx || conn);

const doRefreshSubscriptions = async (conn, ctx) => {
  await deleteExistingSubscriptions(conn, ctx);
  await saveDefaultSubscriptions(conn, ctx);
  await insertHandleCAIPartySubscription(conn, ctx);
  await updateExportSubscription(conn, ctx);
  await updateScoringSubscription(conn, ctx);
  await updateCompleteContactInfoSubscription(conn, ctx);
  await updateRemoveAnonymousEmailSubscription(conn, ctx);
  await updateCountersignSubscription(conn, ctx);
  await updateIntroduceYourselfSubscription(conn, ctx);
  await updateContactBackSubscription(conn, ctx);
  await updateSendLeaseEmailSubscription(conn, ctx);
  await updateSendAppointmentEmailSubscription(conn, ctx);
  await updateSendRegistrationEmailSubscription(conn, ctx);
  await updateSendApplicationStatusUpdatedEmailSubscription(conn, ctx);
  await updateScreeningSubscription(conn, ctx);
  await updateSendQuoteEmailSubscription(conn, ctx);
  await updatePersonApplicationInviteSubscription(conn, ctx);
  await updatePromoteApplicationTaskSubscription(conn, ctx);
  await updateReviewApplicationTaskSubscription(conn, ctx);
  await updateSendContractTaskSubscription(conn, ctx);
  await updateSendRenewalQuoteSubscription(conn, ctx);
  await updateSendRenewalReminderSubscription(conn, ctx);
  await updateSendResidentsInviteSubscription(conn, ctx);
  await updateCustomMessagesSubscription(conn, ctx);
  await updateCorticonSubscription(conn, ctx);
  await updateCreatePartyMemberSubscription(conn, ctx);
  await updateReassignPartiesFromInactiveTeamSubscription(conn, ctx);
  await updateCollectServiceAnimalDocSubscription(conn, ctx);
  await updateCollectEmergencyContactSubscription(conn, ctx);
  await updateContactPartyDeclinedDecisionSubscription(conn, ctx);
};

export const refreshSubscriptions = async ctx =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    logger.debug({ ctx: innerCtx }, 'refreshSubscriptions');
    await doRefreshSubscriptions(knex, innerCtx);
    await disableRecurringJobEvents(knex, innerCtx);
  }, ctx);

// this method will run in the same transaction as the migration files to avoid deadlocks
// use this whenever you need to refresh subscriptions from a migration
export const refreshSubscriptionsUsingMigrationTransaction = async (conn, ctx) => await doRefreshSubscriptions(conn, ctx);
export const updateMultipleSubscriptions = async (ctx, subscriptions) => {
  logger.debug({ ctx, subscriptions }, 'updateMultipleSubscriptions');

  const newValuesSubselect = subscriptions
    .map(sub => {
      const eventsArray = sub.activeForEvents.length ? sub.activeForEvents.map(e => `'${e}'`).join(',') : '';
      return `SELECT '${sub.id}'::uuid as "id",
               '${sub.decision_name}' as "decision_name",
               '${sub.auth_token}' as "auth_token",
               '${sub.url}' as "url",
               ARRAY[${eventsArray}]::varchar[] as "activeForEvents"`;
    })
    .join('UNION ALL ');

  const dml = `WITH newValues AS (${newValuesSubselect})
               UPDATE db_namespace."Subscriptions" AS upd
               SET "decision_name" = n."decision_name",
               "auth_token" = n."auth_token",
               "url" = n."url",
               "activeForEvents" = n."activeForEvents"
               FROM newValues AS n
               WHERE upd."id" = n."id"`;

  const { rows } = await rawStatement(ctx, dml);

  return rows;
};

export const deleteMultipleSubscriptions = async (ctx, subscriptionIds) => {
  logger.debug({ ctx, subscriptionIds }, 'deleteMultipleSubscriptions');

  const ids = subscriptionIds.map(s => `'${s}'::uuid`).join(', ');
  const dml = `DELETE FROM db_namespace."Subscriptions"
               WHERE "id" IN (${ids})`;

  const { rows } = await rawStatement(ctx, dml);

  return rows;
};

export const integratePartyCreatePartyMemberSubscription = async (conn, ctx, tenant) => {
  const subscriptionName = 'party:partyMember';
  const subscription = await getSubscriptionByName(ctx, subscriptionName);
  const hasTenantConditionsForSubscription = await shouldProcessPartyCreatePartyMemberSubscription(ctx, tenant);

  if (!subscription && hasTenantConditionsForSubscription) {
    await insertPartyCreatePartyMemberSubscription(conn, ctx);
  } else if (subscription) {
    // Inactive or active subscription based on tenant conditions
    const inactiveSince = hasTenantConditionsForSubscription ? null : now().toJSON();
    await updateSubscriptionState(conn, ctx, [subscriptionName], inactiveSince);
  }
};

export const insertMultipleSubscriptions = async (ctx, subscriptions) => {
  logger.debug({ ctx, subscriptions }, 'insertMultipleSubscriptions');

  const newValuesSubselect = subscriptions
    .map(sub => {
      const eventsArray = sub.activeForEvents.length ? sub.activeForEvents.map(e => `'${e}'`).join(',') : '';
      return `SELECT '${sub.id}'::uuid as "id",
               '${sub.decision_name}' as "decision_name",
               '${sub.auth_token}' as "auth_token",
               '${sub.url}' as "url",
               ARRAY[${eventsArray}]::varchar[] as "activeForEvents"`;
    })
    .join('UNION ALL ');

  const dml = `INSERT INTO db_namespace."Subscriptions"
               ("id", "decision_name", "auth_token", "url", "activeForEvents")
               SELECT n."id", n."decision_name", n."auth_token", n."url", n."activeForEvents" FROM
               (${newValuesSubselect}) n`;

  const { rows } = await rawStatement(ctx, dml);

  return rows;
};

export const updateDecisionServiceBackend = async (ctx, backendName) => {
  logger.debug({ ctx, backendName }, 'updateDecisionServiceBackend');
  const { rows } = await rawStatement(ctx, `select db_namespace.update_ds_backend('${backendName}')`);
  return rows;
};
