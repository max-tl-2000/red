/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import loggerModule from '../../common/helpers/logger';
import { ServiceError } from '../common/errors';
import { createJWTToken } from '../../common/server/jwt-helpers';
import {
  processCompleteContactInfo,
  processCounterSignLease,
  processIntroduceYourself,
  processRemoveAnonymousEmail,
  processContactBack,
  processPromoteApplication,
  processSendContract,
  processReviewApplication,
  processSendRenewalQuote,
  processSendRenewalReminder,
  processCollectServiceAnimalDoc,
  processCollectEmergencyContact,
  processContactPartyDeclinedDecision,
} from './tasks/taskHandler';
import * as emailHandler from './emails/emailsHandler';
import { processCustomMessage } from './customMessages/customMessagesHandler';
import { recomputePartyScore } from './scoring/scoring';
import { computePartyScreeningResult } from './screening/corticon';
const logger = loggerModule.child({ subType: 'decision_service/actions' });
import config from './config';
import CorticonDecisionServiceAdapter from './adapters/corticonDecisionServiceAdapter';
import DecisionServiceAdapter from '../common/decision_service/adapters/decisionServiceAdapter';
import { processCorticonActions } from './handlers/corticonHandler';
import { handleCai } from './cAI/party';
import { processCreatePartyMember } from './party/partyMember';
import { processReassignParty } from './party/reassignPartyHandler';

const { decisionServiceID } = config;

const decisionServiceAdapter = new DecisionServiceAdapter(new CorticonDecisionServiceAdapter(logger));

const handleError = (error, loggerCtx, loggerName) => {
  logger.error(loggerCtx(error), loggerName);
  throw new ServiceError({ status: 400 });
};

const executeAction = async (actionPromise, loggerCtx, loggerName) => {
  const { error } = await actionPromise().catch(err => handleError(err, loggerCtx, loggerName));
  if (error) handleError(error, loggerCtx, loggerName);

  return { status: 200 };
};

export const handlePartyScoring = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/scoring');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await recomputePartyScore({ ctx: req, party, token }),
    error => ({ ctx: req, error }),
    'party/scoring',
  );
};

export const handlePartyScoringViaCorticon = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/scoring');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await recomputePartyScore({ ctx: req, party, token, useCorticon: true }),
    error => ({ ctx: req, error }),
    'party/scoring',
  );
};

export const handleCompleteContactInfo = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/completeContactInfo');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processCompleteContactInfo(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/completeContactInfo',
  );
};

export const handleSendRenewalQuote = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id, documentVersion }, 'tasks/sendRenewalQuote');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  await processSendRenewalQuote(req, party, token).catch(error => logger.error({ ctx: req, error }, 'tasks/sendRenewalQuote'));
  return 200;
};

export const handleSendRenewalReminder = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id, documentVersion }, 'tasks/sendRenewalReminder');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  await processSendRenewalReminder(req, party, token).catch(error => logger.error({ ctx: req, error }, 'tasks/sendRenewalReminder'));
  return 200;
};

export const handleCollectServiceAnimalDoc = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id, documentVersion }, 'tasks/collectServiceAnimalDoc');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  await processCollectServiceAnimalDoc(req, party, token).catch(error => logger.error({ ctx: req, error }, 'tasks/collectServiceAnimalDoc'));
  return 200;
};

export const handleCollectEmergencyContact = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id, documentVersion }, 'tasks/collectEmergencyContact');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  await processCollectEmergencyContact(req, party, token).catch(error => logger.error({ ctx: req, error }, 'tasks/collectEmergencyContact'));
  return 200;
};

export const handleContactPartyDeclinedDecision = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id, documentVersion }, 'tasks/contactPartyDeclinedDecision');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processContactPartyDeclinedDecision(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/contactPartyDeclinedDecision',
  );
};

export const handleLease = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/lease');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await emailHandler.processLease(req, party, token),
    error => ({ ctx: req, error }),
    'party/lease',
  );
};

export const handleCounterSign = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/counterSign');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processCounterSignLease(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/counterSign',
  );
};

export const handleIntroduceYourself = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/introduceYourself');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processIntroduceYourself(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/introduceYourself',
  );
};

export const handleReviewApplication = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/reviewApplication');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processReviewApplication(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/reviewApplication',
  );
};

export const handleAppointment = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/appointment');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await emailHandler.processAppointment(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/appointment',
  );
};

export const handlePayment = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/applicationPayment');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await emailHandler.processPayment(req, party, token),
    error => ({ ctx: req, error }),
    'party/applicationPayment',
  );
};

export const handleApplicationUpdates = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/application');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await emailHandler.processApplication(req, party, token),
    error => ({ ctx: req, error }),
    'party/application',
  );
};

export const handleRemoveAnonymousEmail = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/removeAnonymousEmail');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processRemoveAnonymousEmail(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/removeAnonymousEmail',
  );
};

export const handleContactBack = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/contactBack');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processContactBack(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/contactBack',
  );
};

export const handlePartyScreening = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/screening');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await computePartyScreeningResult({ ctx: req, party, token }),
    error => ({ ctx: req, error }),
    'party/screening',
  );
};

export const handlePartyCai = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/handlePartyCai');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await handleCai({ ctx: req, party, token }),
    error => ({ ctx: req, error }),
    'party/handleCai',
  );
};

export const handleQuote = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'email/quote');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await emailHandler.processQuote(req, party, token),
    error => ({ ctx: req, error }),
    'party/quote',
  );
};

export const handleCustomMessage = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/customMessages');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processCustomMessage(req, party, token),
    error => ({ ctx: req, error }),
    'party/customMessages',
  );
};

export const handlePersonApplicationInvite = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/personApplicationInvite');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await emailHandler.processPersonApplicationInvite(req, party, token),
    error => ({ ctx: req, error }),
    'email/personApplicationInvite',
  );
};

export const handleResidentsInvite = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'email/residentsInvite');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await emailHandler.processResidentsInvite(req, party, token),
    error => ({ ctx: req, error }),
    'email/residentsInvite',
  );
};

export const handlePromoteApplication = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/promoteApplication');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processPromoteApplication(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/promoteApplication',
  );
};

export const handleSendContract = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'tasks/sendContract');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processSendContract(req, party, token),
    error => ({ ctx: req, error }),
    'tasks/sendContract',
  );
};

export const handleCorticonDecisionRequest = async ctx => {
  const { body: event } = ctx;
  const { id: partyId, version: documentVersion } = event;
  logger.trace({ ctx, partyId, documentVersion }, 'handleCorticonDecisionRequest');

  const actions = await decisionServiceAdapter.getActions({ ctx, event });

  if (actions.length > 0) {
    const token = createJWTToken({ tenantId: ctx.tenantId, decisionServiceID, documentVersion, partyId }, { expiresIn: '1d' });

    return await executeAction(
      async () => await processCorticonActions(ctx, event, token, actions),
      error => ({ ctx, error }),
      'handleCorticonDecisionRequest',
    );
  }

  return { status: 200 };
};

export const handleCreatePartyMemberDecision = async ctx => {
  const { body } = ctx;
  const documentVersion = body.version;
  const party = body;
  logger.trace({ ctx, partyId: party.id }, 'party/partyMember');
  const token = createJWTToken({ tenantId: ctx.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });

  return await executeAction(
    async () => await processCreatePartyMember(ctx, party, token),
    error => ({ ctx, error }),
    'party/partyMember',
  );
};

export const handleReassignPartyDecision = async req => {
  const documentVersion = req.body.version;
  const party = req.body;
  logger.trace({ ctx: req, partyId: party.id }, 'party/reassign');
  const token = createJWTToken({ tenantId: req.tenantId, decisionServiceID, documentVersion, partyId: party.id }, { expiresIn: '1d' });
  return await executeAction(
    async () => await processReassignParty(req, party, token),
    error => ({ ctx: req, error }),
    'party/reassign',
  );
};
