/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Promise from 'bluebird';
import getUUID from 'uuid/v4';
import { getAvailableNumbers } from '../../workers/communication/commProviderIntegration';
import config from '../../config';
import { createTruncateFunction, truncateTablesOnSchemas, disableAutomaticLogoutRecurringJob, getTenant } from '../../services/tenantService';
import { isUuid } from '../../common/utils';
import { ServiceError } from '../../common/errors';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE, JOBS_MESSAGE_TYPE } from '../../helpers/message-constants';

import { sendMessage } from '../../services/pubsub';
import { getLastEmail, getLastIncomingEmail, getCommunicationsForParty as getCommunicationsForPartyDB } from '../../dal/communicationRepo';
import { loadProgramForIncomingCommByEmail } from '../../dal/programsRepo';
import loggerModule from '../../../common/helpers/logger';
import { enqueueInboundSmsReceived } from './webhooks';
import { importRandomParty } from '../../import/demo_sample_data/import';
import { resetEmailMocks } from '../../workers/communication/inboundEmailHandler';
import { getTelephonyOps } from '../../services/telephony/providerApiOperations';
import { importAndProcessWorkflows } from '../../services/activeLease';
import parseBoolean from '../../../common/helpers/booleanParser';
import { DALTypes } from '../../../common/enums/DALTypes';
import { jobIsInProgress } from '../../services/helpers/jobs';
import { runInTransaction } from '../../database/factory';
import { createJob } from '../../services/jobs.js';
import { createAnAppointment } from '../../testUtils/repoHelper';
import { saveFee, getFeesByFilter } from '../../dal/feeRepo';

const { apiToken } = config;
const logger = loggerModule.child({ subType: 'api/testing' });

const validateRequest = req => {
  const reqApiToken = req.query.apiToken;

  if (!reqApiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_REQUIRED',
      status: 403,
    });
  }

  if (reqApiToken !== apiToken) {
    throw new ServiceError({
      token: 'API_TOKEN_INVALID',
      status: 403,
    });
  }
};

export const getAnAvailableCucumberPhoneNumber = async req => {
  const phoneSupportEnabled = req.body.phoneSupportEnabled;
  logger.info(`Getting available phone numbers with phone support: ${phoneSupportEnabled}`);
  const availablePhoneNumbers = await getAvailableNumbers(phoneSupportEnabled, true);
  validateRequest(req);

  if (!availablePhoneNumbers.length) {
    throw new ServiceError({
      token: 'NO_PHONE_NUMBER_AVAILABLE',
      status: 404,
    });
  }
  return availablePhoneNumbers[0];
};

export const getProgramByEmailIdentifier = async req => {
  const { tenantId, directEmailIdentifier } = req.body;
  logger.info(`Getting the program by email identifier: ${directEmailIdentifier}`);
  req.tenantId = tenantId;
  return await loadProgramForIncomingCommByEmail(req, directEmailIdentifier);
};

const receivedTestSmsMessages = {};

export const fakeSmsReceiver = async req => {
  try {
    logger.warn(`Saving inbound test SMS: ${JSON.stringify(req.body)}`);
    receivedTestSmsMessages[req.body.From] = req.body;
    logger.trace(`Received messages: ${receivedTestSmsMessages}`);
  } catch (error) {
    logger.error({ error }, 'Error while handling received sms for testing');
    throw new ServiceError({ status: 500 });
  }
};

export const sendGuestSMS = async req => {
  validateRequest(req);
  const { msg: text, to: dst, tenantId } = req.body;
  const tenant = await getTenant({ tenantId });
  const src = tenant.metadata.plivoGuestPhoneNumber;
  const isPhoneSupportEnabled = tenant.metadata.isPhoneSupportEnabled;

  logger.trace(tenant, 'Sending SMS from guest from tenant');
  if (!src) {
    throw new ServiceError({
      token: 'NO_NUMBER_ASSIGNED_TO_GUEST',
      status: 400,
    });
  }

  const sms = {
    src,
    dst,
    text,
  };

  if (!isPhoneSupportEnabled) {
    const fakeReq = {
      tenantId,
      body: {
        From: sms.src,
        Text: sms.text,
        MessageUUID: Date.now(),
        To: sms.dst,
      },
    };
    receivedTestSmsMessages[src] = fakeReq.body;
    await enqueueInboundSmsReceived(fakeReq);
    return src;
  }

  try {
    const response = await getTelephonyOps().sendMessage(sms);
    if (!response.messageUuid || !response.messageUuid.length > 0) throw new Error(response.error);
    logger.trace(`Guest message sent: ${response}`);
  } catch (error) {
    logger.error({ error }, `Error while sending sms to ${sms.dst}`);
    throw error;
  }

  return src;
};

export const verifyEmailIsDeliveredToGuest = async req => {
  logger.trace({ ctx: req }, 'verifyEmailIsDeliveredToGuest');
  validateRequest(req);
  const { subject, tenantId } = req.body;

  let noOfTries = 0;

  req.tenantId = tenantId;

  while (noOfTries < 30) {
    logger.warn(`Checking if guest received email: try# ${noOfTries} subject: ${subject}`);
    const [email] = await getLastEmail(req);
    logger.trace(`Last email ${JSON.stringify(email, null, 2)}`);
    if (email && email.status.status.find(s => s.status === 'Delivery')) {
      return {
        token: 'MESSAGE_RECEIVED',
        status: 200,
      };
    }
    await Promise.delay(5000);
    noOfTries++;
  }

  throw new ServiceError({
    token: 'MESSAGE_NOT_RECEIVED',
    status: 404,
  });
};

export const getCommunicationsForParty = async req => {
  logger.trace({ ctx: req }, 'getting communications for party');
  validateRequest(req);
  const { partyId, tenantId, type, direction } = req.body;

  req.tenantId = tenantId;
  try {
    return await getCommunicationsForPartyDB(req, partyId, { type, direction });
  } catch (e) {
    logger.error({ ctx: req, partyId, error: e }, 'Error getting communications for party');
    throw new ServiceError({
      token: 'ERROR_GETTING_COMMUNICATIONS',
      status: 500,
    });
  }
};

export const replyToEmailWith = async req => {
  logger.trace({ ctx: req }, 'replyToEmailWith');
  validateRequest(req);
  const { replyText, tenantId } = req.body;
  req.tenantId = tenantId;
  const [
    {
      messageId,
      message: { to, from },
    },
  ] = await getLastEmail(req);

  const fromParts = from.split(' ');
  const toEmail = fromParts[fromParts.length - 1];

  const replyMessageId = getUUID();
  const message = {
    Bucket: getUUID(),
    Key: replyMessageId,
    fakeEmail: {
      event: 'inbound',
      msg: {
        emails: [toEmail],
        from_email: to[0],
        from_name: 'rhaenys',
        text: replyText,
        subject: 'reply to email',
        messageId: replyMessageId,
        inReplyTo: messageId,
      },
    },
  };
  await sendMessage({ exchange: APP_EXCHANGE, key: COMM_MESSAGE_TYPE.INBOUND_EMAIL, message, ctx: req });

  let noOfTries = 0;
  while (noOfTries < 20) {
    logger.warn(`Checking if reply email is processed: try# ${noOfTries}`);
    const [lastEmail] = await getLastIncomingEmail(req);
    const { messageId: lastMessageId } = lastEmail || {};
    if (lastMessageId === replyMessageId) {
      resetEmailMocks();
      return {
        token: 'REPLY_MESSAGE_RECEIVED',
        status: 200,
      };
    }

    await Promise.delay(500);
    noOfTries++;
  }

  resetEmailMocks();
  throw new ServiceError({
    token: 'REPLY_MESSAGE_NOT_PROCESSED',
    status: 404,
  });
};

export const sendGuestEmail = async req => {
  logger.trace({ ctx: req }, 'sendGuestEmail');
  validateRequest(req);
  const { subject, body, tenantId } = req.body;
  req.tenantId = tenantId;
  const [
    {
      message: { to, from },
    },
  ] = await getLastEmail(req);

  const fromParts = from.split(' ');
  const toEmail = fromParts[fromParts.length - 1];

  const newMessageId = getUUID();
  const message = {
    Bucket: getUUID(),
    Key: newMessageId,
    fakeEmail: {
      event: 'inbound',
      msg: {
        emails: [toEmail],
        from_email: to[0],
        from_name: 'rhaenys',
        text: body,
        subject,
        messageId: newMessageId,
      },
    },
  };
  await sendMessage({ exchange: APP_EXCHANGE, key: COMM_MESSAGE_TYPE.INBOUND_EMAIL, message, ctx: req });

  let noOfTries = 0;
  while (noOfTries < 20) {
    logger.warn(`Checking if incoming email is processed: try# ${noOfTries}`);
    const [lastEmail] = await getLastIncomingEmail(req);
    const { messageId: lastMessageId } = lastEmail || {};
    if (lastMessageId === newMessageId) {
      resetEmailMocks();
      return {
        token: 'INCOMING_MESSAGE_RECEIVED',
        status: 200,
      };
    }

    await Promise.delay(500);
    noOfTries++;
  }

  resetEmailMocks();
  throw new ServiceError({
    token: 'INCOMING_MESSAGE_NOT_PROCESSED',
    status: 404,
  });
};

export const verifyGuestReceivedMessageFromNumber = async req => {
  validateRequest(req);
  const { receivedMessage, from } = req.body;

  let noOfTries = 0;

  while (noOfTries < 20) {
    logger.warn(`Checking if guest received message: try# ${noOfTries} from: ${from} message: ${receivedMessage}`);

    if (receivedTestSmsMessages[from] && receivedTestSmsMessages[from].Text === receivedMessage) {
      return {
        token: 'MESSAGE_RECEIVED',
        status: 200,
      };
    }
    await Promise.delay(5000);
    noOfTries++;
  }

  throw new ServiceError({
    token: 'MESSAGE_NOT_RECEIVED',
    status: 404,
  });
};

export const createGuestApplication = async req => {
  validateRequest(req);
  logger.trace(`Creating guest application for: ${req.body}`);
  const hostname = req.hostname;
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.CREATE_GUEST_APPLICATION,
    message: { ...req.body, hostname },
    ctx: req,
  });
};

export const forceLogout = async req => {
  validateRequest(req);
  const { tenantId } = req.body;

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: JOBS_MESSAGE_TYPE.MARK_USERS_UNAVAILABLE,
    message: { tenantId },
    ctx: { tenantId },
  });
};

export const disableAutomaticLogout = async req => {
  validateRequest(req);

  await disableAutomaticLogoutRecurringJob(req.body);
};

export const createTruncanteFn = async req => {
  validateRequest(req);
  await createTruncateFunction(req);
};

export const truncateSchemaTables = async req => {
  validateRequest(req);

  const { tenant, schemas = [] } = req.body;

  await truncateTablesOnSchemas(tenant, schemas);
};

export const deleteMessagesFromNumber = async req => {
  validateRequest(req);
  const { from } = req.body;
  receivedTestSmsMessages[from] = {};
};

// Creates a one-person party, complete with shared quote; returns link to application for that party
export const createDummyParty = async req => {
  const { authUser } = req;
  const {
    teams: [{ id: teamId }],
  } = authUser;
  return await importRandomParty(req, authUser.id, teamId);
};

const createJobEntry = async ctx => {
  if (await jobIsInProgress(ctx, DALTypes.Jobs.ImportAndProcessPartyWorkflows)) {
    throw new ServiceError({
      token: 'IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS',
      status: 412,
    });
  }

  const jobDetails = {
    name: DALTypes.Jobs.ImportAndProcessPartyWorkflows,
    category: DALTypes.JobCategory.MigrateData,
  };

  return (await createJob(ctx, {}, jobDetails)).id;
};

export const importActiveLeases = async req => {
  logger.trace({ ctx: req, reqQuery: req.query }, 'importActiveLeases - input params');
  const {
    propertyId: propertyExternalId,
    primaryExternalId = '',
    partyGroupId = '',
    skipImport = false,
    skipProcess = false,
    isInitialImport = false,
    forceSyncLeaseData = false,
  } = req.query;

  const skipImportParsed = parseBoolean(skipImport);
  const skipProcessParsed = parseBoolean(skipProcess);
  const isInitialImportParsed = parseBoolean(isInitialImport);
  const forceSyncLeaseDataParsed = parseBoolean(forceSyncLeaseData);

  if (!propertyExternalId) {
    await runInTransaction(async trx => {
      const innerCtx = { trx, ...req };
      const jobId = await createJobEntry(innerCtx);
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: JOBS_MESSAGE_TYPE.IMPORT_AND_PROCESS_PARTY_WORKFLOWS,
        message: {
          tenantId: req.tenantId,
          skipImport: skipImportParsed,
          skipProcess: skipProcessParsed,
          isInitialImport: isInitialImportParsed,
          forceSyncLeaseData: forceSyncLeaseDataParsed,
          jobIdToUpdate: jobId,
          triggeredManually: true,
        },
        ctx: innerCtx,
      });
    }, req);
  } else {
    await importAndProcessWorkflows(req, {
      skipImport: skipImportParsed,
      skipProcess: skipProcessParsed,
      propertyExternalId,
      primaryExternalId,
      partyGroupId,
      isInitialImport: isInitialImportParsed,
      forceSyncLeaseData: forceSyncLeaseDataParsed,
    });
  }
};

export const createAnAppointmentForParty = async req => {
  logger.trace({ ctx: req }, 'create an appointment');
  validateRequest(req);

  const { tenantId, salesPersonId, partyId, tourType, loadActivePartyMembers } = req.body;
  try {
    return await createAnAppointment({
      tenantId,
      salesPersonId,
      partyId,
      metadata: { tourType },
      loadActivePartyMembers,
    });
  } catch (e) {
    logger.error({ ctx: req, partyId, error: e }, 'Error creating appointment for party');
    throw new ServiceError({
      token: 'ERROR_CREATE_APPOINTMENT_FOR_PARTY',
      status: 500,
    });
  }
};

export const updateFeePricingByPropertyId = async req => {
  const { propertyId, tenantId } = req.params;
  const { absolutePrice, feeDisplayName } = req.body;
  const ctx = { tenantId };
  // validate parameters
  if (!propertyId) {
    throw new ServiceError({
      token: 'MISSING_REQUIRED_PARAMETER_PROPERTY_ID',
      status: 400,
    });
  }
  if (!tenantId) {
    throw new ServiceError({
      token: 'MISSING_REQUIRED_PARAMETER_TENANT_ID',
      status: 400,
    });
  }
  if (!feeDisplayName) {
    throw new ServiceError({
      token: 'MISSING_REQUIRED_PARAMETER_FEE_DISPLAY_NAME',
      status: 400,
    });
  }
  if (!absolutePrice) {
    throw new ServiceError({
      token: 'MISSING_REQUIRED_PARAMETER_ABSOLUTE_PRICE',
      status: 400,
    });
  }
  if (!isUuid(propertyId)) throw new ServiceError({ token: 'INVALID_PROPERTY_ID' });
  if (!isUuid(tenantId)) throw new ServiceError({ token: 'INVALID_TENANT_ID' });
  const [fee] = (await getFeesByFilter(ctx, query => query.where({ propertyId, displayName: feeDisplayName }))) || [];
  // validation fee no found
  if (!fee) {
    throw new ServiceError({
      token: 'FEE_NOT_FOUND',
      status: 404,
    });
  }
  return await saveFee(ctx, { ...fee, absolutePrice, propertyId });
};
