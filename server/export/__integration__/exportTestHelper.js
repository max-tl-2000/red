/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fse from 'fs-extra';
import request from 'supertest';
import { expect } from 'chai';

// Reva API
import app from '../../api/api';
// Export API
import exportApp from '../api';

import { tenant, enableAggregationTriggers, chan, createResolverMatcher } from '../../testUtils/setupTestGlobalContext';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE, EXPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { LA_TIMEZONE } from '../../../common/date-constants';
import { updateTenant } from '../../services/tenantService';
import config from '../../config';
import * as leaseTestHelper from '../../testUtils/leaseTestHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { setupConsumers } from '../../workers/consumer';
import { waitFor, getAuthHeader } from '../../testUtils/apiHelper';
import { acquireDocument, getPartyDocumentIdsByPartyId } from '../../dal/partyDocumentRepo';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { sortByCreationDate } from '../../../common/helpers/sortBy';
import { createTestFees, createSecurityDeposit } from '../../testUtils/exportTestHelper';
import { createAnInventoryItem } from '../../testUtils/repoHelper';

const { cloudEnv } = config;

const tenantFolder = path.resolve(__dirname, '../../../uploads', cloudEnv, 'tenants', tenant.id);
export const exportFolder = path.resolve(tenantFolder, 'export');

export const cleanUp = () => fse.removeSync(tenantFolder);
export const cleanUpExportFolder = async () => await fse.removeSync(exportFolder);

export const setupMsgQueueAndWaitFor = async (conditions, workerKeysToBeStarted) => {
  const { resolvers, promises } = waitFor(conditions);
  const matcher = createResolverMatcher(resolvers);
  await setupConsumers(chan(), matcher, workerKeysToBeStarted);
  return { task: Promise.all(promises), matcher };
};

export const createTestData = async ({
  backendMode,
  residentEmail,
  daysFromNow = 0,
  timezone = LA_TIMEZONE,
  propertyDisplayName,
  isCorporateParty,
  appSettings,
  createSecondQuote,
} = {}) => {
  await cleanUp();

  await updateTenant(tenant.id, {
    metadata: {
      ...tenant.metadata,
      backendIntegration: {
        name: backendMode,
      },
    },
    settings: tenant.settings,
  });

  await enableAggregationTriggers(tenant.id);

  const { task, matcher } = await setupMsgQueueAndWaitFor([], ['lease', 'tasks', 'screening', 'export', 'history']);
  const leaseTestData = await leaseTestHelper.createLeaseTestData({
    applicantSettings: {
      dateOfBirth: toMoment('3/10/2022').toDate(),
    },
    residentEmail,
    daysFromNow,
    timezone,
    propertyDisplayName,
    isCorporateParty,
    backendMode,
    appSettings,
    createSecondQuote,
  });
  await task;

  return {
    ...leaseTestData,
    matcher,
  };
};

const exportRequest = async (party, doc) => {
  const header = getAuthHeader(tenant.id, party.userId, null, false, { partyId: party.id, documentVersion: doc.id });
  return await request(exportApp)
    .post('/v1/export')
    .set(header)
    .send({ ...doc.document, version: doc.id });
};

export const getMatchingDocument = async (ctx, partyId, eventType) => {
  const ids = await getPartyDocumentIdsByPartyId(ctx, partyId);

  const docs = await Promise.all(ids.map(async ({ id }) => await acquireDocument(ctx, id)));

  const nulls = doc => doc && doc.document && doc.document.events;
  const matchingEvent = doc => doc.document.events.find(ev => ev.event === eventType);
  const matchingDocs = docs
    .filter(nulls)
    .filter(matchingEvent)
    .sort((a, b) => sortByCreationDate(a, b, { field: 'created_at', sortOrder: 'DESC' }));

  if (!matchingDocs.length) throw new Error(`Cannot find any matching event of type ${eventType}`);

  return matchingDocs[0];
};

export const waitForMessage = async (matcher, msgType) => {
  const condition = (payload, processed, msg) => msg.fields.routingKey === msgType;
  const {
    resolvers,
    promises: [task],
  } = waitFor([condition]);
  matcher.addWaiters(resolvers);

  return task;
};

export const generateExportLogData = async (ctx, matcher, party, eventType) => {
  const matchingDoc = await getMatchingDocument(ctx, party.id, eventType);
  const result = await exportRequest(party, matchingDoc);
  expect(result.statusCode).to.equal(200, 'Expected /export request to be successful');
};

export const triggerExportToYardi = async (ctx, matcher) => {
  const exportTask = waitForMessage(matcher, EXPORT_MESSAGE_TYPE.EXPORT_TO_YARDI);

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: EXPORT_MESSAGE_TYPE.EXPORT_TO_YARDI,
    message: { tenantId: ctx.tenantId },
    ctx: { tenantId: tenant.id },
  });

  await exportTask;
};

export const doExport = async (ctx, matcher, party, eventType) => {
  await generateExportLogData(ctx, matcher, party, eventType);
  await triggerExportToYardi(ctx, matcher);
};

export const markAppointmentAsCompleted = async (appointmentId, userId) => {
  const result = await request(app)
    .patch(`/tasks/${appointmentId}`)
    .set(getAuthHeader(tenant.id, userId))
    .send({ state: DALTypes.TaskStates.COMPLETED })
    .send({
      state: DALTypes.TaskStates.COMPLETED,
      metadata: {
        appointmentResult: DALTypes.AppointmentResults.COMPLETE,
      },
    });
  expect(result.statusCode).to.equal(200, 'Expected mark appointment as completed');
  return result.body;
};

export const publishLease = async (matcher, testData, publishedLeaseData) => {
  const { partyId, userId, promotedQuote } = testData;

  const lease = await leaseTestHelper.createLease(partyId, userId, promotedQuote.id);
  const leaseTestData = { partyId, lease, userId, publishedLease: publishedLeaseData, matcher, skipWaitingForEvents: true };
  await leaseTestHelper.publishLease(leaseTestData);
  return {
    lease,
    partyId,
    userId,
  };
};

export const executeLease = async (matcher, testData, publishedLeaseData, counterSignLease = true, onlyOneMember = false) => {
  const { lease, partyId } = await publishLease(matcher, testData, publishedLeaseData);

  if (onlyOneMember) {
    return await leaseTestHelper.signLeaseByOneMember(lease.id, partyId);
  }

  if (!counterSignLease) {
    return await leaseTestHelper.signLeaseByAllPartyMembers(lease.id, partyId, matcher, false);
  }
  await leaseTestHelper.signLeaseByAllPartyMembers(lease.id, partyId, matcher, false);

  return await leaseTestHelper.counterSignLease(lease.id, partyId, matcher, false);
};

const getAdditionalCharges = async propertyId => {
  const charges = await createTestFees(3, 'additional', propertyId);
  const result = {};
  charges.forEach(charge => {
    result[charge.id] = {
      amount: charge.absolutePrice,
      displayName: charge.displayName,
      quantity: 1,
    };
  });

  return result;
};

const getPublishedLeaseConcessions = async concessions => {
  if (!concessions) return {};
  const result = {};

  concessions.forEach(charge => {
    result[charge.id] = {
      amount: 100,
      relativeAmount: 8,
    };
  });

  return result;
};

const getOneTimeCharges = async propertyId => {
  const charges = await createTestFees(3, 'oneTime', propertyId);
  charges.push(await createSecurityDeposit(propertyId));

  const result = {};
  charges.forEach(charge => {
    result[charge.id] = {
      amount: charge.absolutePrice,
      ...charge,
    };
  });

  return result;
};

export const getPublishedLeaseData = async ({ propertyId, concessions, daysFromNow = 0, timezone = LA_TIMEZONE, skipConcessions, skipCharges } = {}) => {
  const nowDate = now({ timezone });
  const leaseStartDate = nowDate.clone().startOf('day').add(daysFromNow, 'days');

  return {
    leaseStartDate: leaseStartDate.toJSON(),
    leaseEndDate: leaseStartDate.clone().add(12, 'months').startOf('day').toJSON(),
    moveInDate: leaseStartDate.toJSON(),
    moveinRentEndDate: leaseStartDate.clone().endOf('month').startOf('day').toJSON(),
    unitRent: 500,
    termLength: 12,
    rentersInsuranceFacts: 'buyInsuranceFlag',
    concessions: !skipConcessions ? await getPublishedLeaseConcessions(concessions) : {},
    additionalCharges: !skipCharges ? await getAdditionalCharges(propertyId) : {},
    oneTimeCharges: !skipCharges ? await getOneTimeCharges(propertyId) : {},
  };
};

export const getSelectedInventories = async () => {
  // the externalId is parsed, must be in the format 'igName-someCode'
  const inventory = await createAnInventoryItem({ externalId: 'testInventoryGroup-selected123' });
  return [inventory];
};

const initiatePayment = async (userId, partyId, personId, paymentData) => {
  const result = await request(app)
    .post('/payment/initiate')
    .set(
      getAuthHeader(tenant.id, userId, null, false, {
        partyId,
        personId,
      }),
    )
    .send(paymentData);

  expect(result.statusCode).to.equal(200, 'Expected initiaing payment to be successful');
  return result;
};

export const payApplicationFee = async testData => {
  const { userId, party, residents, personsApplications, applicationFee, holdDepositFee = {}, property, applicationFeeWaiverAmount } = testData;
  const application = personsApplications[0];
  const invoice = {
    applicationFeeId: applicationFee.id,
    applicationFeeAmount: applicationFee.absolutePrice,
    personApplicationId: application.id,
    holdDepositFeeId: holdDepositFee.id,
    holdDepositFeeIdAmount: holdDepositFee.absolutePrice,
    propertyId: property.id,
    applicationFeeWaiverAmount: applicationFeeWaiverAmount || 0,
  };

  const resident = residents[0];
  const paymentData = {
    firstName: resident.fullName,
    email: 'luke@reva.tech',
    invoice,
    reportCopyRequested: false,
    otherApplicants: [],
    guarantors: [],
  };

  const {
    body: { invoiceId },
  } = await initiatePayment(userId, party.id, resident.personId, paymentData);

  // since integration tests are using the fake provider, we should pass already-parsed data...
  const paymentNotifMsg = {
    personApplicationId: application.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
    host: 'dummyHost',
    invoiceId,
    propertyId: property.id,
    appFeeInvoice: {
      transactionId: 13000,
      targetId: 1,
    },
    holdDepositInvoice: {
      transactionId: 13001,
      targetId: 2,
    },
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED,
    message: paymentNotifMsg,
    ctx: { tenantId: tenant.id },
  });
};
