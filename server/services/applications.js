/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import pick from 'lodash/pick';
import uniq from 'lodash/uniq';
import { DALTypes } from '../../common/enums/DALTypes';
import { ServiceError } from '../common/errors';
import * as partyRepo from '../dal/partyRepo';
import { getFilteredFeesByLeaseState } from '../dal/feeRepo';
import { getPersonsByIds } from '../dal/personRepo';
import { getPartyLeases } from '../dal/leaseRepo';
import { getQuoteById } from '../dal/quoteRepo';
import { runInTransaction } from '../database/factory';
import { getPartyApplicationByPartyId } from '../../rentapp/server/services/party-application';
import { getNumberOfDocumentsByPerson, getPersonApplicationByFilter, getPersonApplicationsByFilter } from '../../rentapp/server/services/person-application';
import { getApplicationTransactionsByPersonApplicationIds } from '../../rentapp/server/services/application-transactions';
import { getPaymentTargetAccounts } from '../../rentapp/server/payment/payment-provider-integration';
import { getApplicationInvoicesByFilter, getPaidApplicationInvoices } from '../../rentapp/server/services/application-invoices';
import { getUnitQuoteName, getUnitNameIfIsHoldByParty } from '../helpers/quotes';
import * as taskUtils from '../helpers/taskUtils';
import { getPropertyAssignedToParty } from '../helpers/party';
import { voidLease } from './leases/leaseService';
import logger from '../../common/helpers/logger';
import { performPartyStateTransition } from './partyStatesTransitions';
import { WAIVER_APPLICATION_FEE_DISPLAY_NAME } from '../../common/application-constants';
import { getDisplayName } from '../../common/helpers/person-helper';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { logEntity } from './activityLogService';
import { getApplicationSummaryForParty } from '../../rentapp/server/screening/utils';
import { toMoment } from '../../common/helpers/moment-utils';
import { isApplicationPaid } from '../../common/helpers/applicants-utils';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import * as eventService from './partyEvent';

const createTransactionObject = ({ feeId, amount, fees, applicantNames, applicationInvoice, transactionType, unitName }) => {
  const matchedFee = fees.find(fee => fee.id === feeId);
  let feeName = matchedFee && matchedFee.displayName;

  if (transactionType === DALTypes.PaymentTransactionType.WAIVER) {
    feeName = WAIVER_APPLICATION_FEE_DISPLAY_NAME;
  }
  const transaction = {
    feeId,
    feeName,
    transactionType: transactionType || DALTypes.PaymentTransactionType.PAYMENT,
    amount,
    date: applicationInvoice.created_at,
    payer: applicantNames[applicationInvoice.personId],
    invoiceId: applicationInvoice.id,
  };

  unitName && Object.assign(transaction, { unitName });

  return transaction;
};

const getTransactionsPerType = (transactions, type) => transactions.filter(trans => trans.transactionType === type);

const isHoldDepositAccount = (targetId, { paymentAccounts }) => {
  const { holdAccounts = [] } = paymentAccounts || {};
  return holdAccounts.some(acc => acc === targetId);
};

const createPaymentTransaction = async ({ tenantId, transaction, invoiceData }) => {
  const { applicationFeeId, holdDepositFeeId, quoteId } = invoiceData.applicationInvoice;
  const invoiceLogData = pick(invoiceData, ['applicantNames', 'applicationInvoice']);
  logger.info(
    {
      tenantId,
      applicationFeeId,
      holdDepositFeeId,
      quoteId,
      invoice: invoiceLogData,
    },
    'createPaymentTransaction',
  );
  let feeId = applicationFeeId;
  let unitName;
  if (holdDepositFeeId && isHoldDepositAccount(transaction.targetId, invoiceData)) {
    feeId = holdDepositFeeId;
    unitName = quoteId && (await getUnitQuoteName({ tenantId, quoteId }));
  }
  const paymentTransaction = createTransactionObject({
    ...invoiceData,
    feeId,
    unitName,
    amount: transaction.amount,
    transactionType: transaction.transactionType,
  });
  paymentTransaction.date = transaction.createdOn;
  return paymentTransaction;
};

const parseToTransaction = (targetId, amount, createdOn, transactionType) => ({
  targetId,
  transactionType,
  createdOn: toMoment(createdOn).toDate(),
  amount: amount / 100,
});

const getRefundTransactions = (tenantId, invoiceData) => {
  const { invoiceTransactions } = invoiceData;
  const refunds = getTransactionsPerType(invoiceTransactions, DALTypes.PaymentTransactionType.REFUND);
  if (!refunds.length) return [];
  return refunds.reduce(async (acc, refundRaw) => {
    const { paymentId = '', amount, createdOn } = refundRaw.transactionData;
    const payment = invoiceTransactions.find(
      trans => trans.transactionType === DALTypes.PaymentTransactionType.PAYMENT && trans.externalId === paymentId.toString(),
    );

    const res = await acc;
    if (payment) {
      const paymentTransaction = await createPaymentTransaction({
        transaction: parseToTransaction(payment.targetId, amount, createdOn, DALTypes.PaymentTransactionType.REFUND),
        tenantId,
        invoiceData,
      });
      res.push(paymentTransaction);
    } else {
      logger.error({ id: paymentId }, 'Missing payment transaction (external id)');
    }
    return res;
  }, Promise.resolve([]));
};

const getVoidTransactions = async (tenantId, invoiceData) => {
  const voids = getTransactionsPerType(invoiceData.invoiceTransactions, DALTypes.PaymentTransactionType.VOID);
  if (!voids.length) return [];

  return await execConcurrent(voids, async voidTrans => {
    const { targetId, grossAmount, voidedOn } = voidTrans.transactionData;

    return await createPaymentTransaction({
      transaction: parseToTransaction(targetId, grossAmount, voidedOn, DALTypes.PaymentTransactionType.VOID),
      tenantId,
      invoiceData,
    });
  });
};

const getTransactionObjectsFromInvoice = async (tenantId, invoiceData) => {
  const transactions = [];
  const { applicationFeeId, holdDepositFeeId, quoteId, applicationFeeWaiverAmount } = invoiceData.applicationInvoice;
  if (applicationFeeId) {
    const applicationFeeTransaction = createTransactionObject({
      ...invoiceData,
      feeId: applicationFeeId,
      amount: invoiceData.applicationInvoice.applicationFeeAmount,
    });
    transactions.push(applicationFeeTransaction);
  }

  const unitName = (quoteId && (await getUnitNameIfIsHoldByParty({ tenantId, quoteId }))) || '';
  if (holdDepositFeeId) {
    const holdDepositFeeTransaction = createTransactionObject({
      ...invoiceData,
      unitName,
      feeId: holdDepositFeeId,
      amount: invoiceData.applicationInvoice.holdDepositFeeIdAmount,
    });

    transactions.push(holdDepositFeeTransaction);
  }

  if (applicationFeeWaiverAmount) {
    const waiverApplicationFeeTransaction = createTransactionObject({
      ...invoiceData,
      feeId: newId(),
      transactionType: DALTypes.PaymentTransactionType.WAIVER,
      amount: invoiceData.applicationInvoice.applicationFeeWaiverAmount,
    });
    transactions.push({ ...waiverApplicationFeeTransaction, feeWaiverReason: invoiceData.applicationInvoice.feeWaiverReason });
  }

  const refundTransactions = await getRefundTransactions(tenantId, invoiceData);
  const voidTransactions = await getVoidTransactions(tenantId, invoiceData);

  return transactions.concat(refundTransactions, voidTransactions);
};

const getPropertyForApplication = async (ctx, partyId, personApplicationId) => {
  const [applicationInvoice] = await getApplicationInvoicesByFilter(ctx, {
    personApplicationId,
    paymentCompleted: true,
  });
  if (!applicationInvoice) return undefined;

  if (!applicationInvoice.quoteId) {
    const party = await partyRepo.loadParty(ctx, partyId);
    return await getPropertyAssignedToParty(ctx, party);
  }

  const quote = await getQuoteById(ctx, applicationInvoice.quoteId);
  return quote.inventory.property;
};

export const getApplicationPaymentsForParty = async (ctx, partyId) => {
  const partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  if (!partyApplication) return null;

  const personApplications = (
    await getPersonApplicationsByFilter(ctx, { partyApplicationId: partyApplication.id }, { includeApplicationsWherePartyMemberIsInactive: true })
  ).filter(isApplicationPaid);
  if (!personApplications.length) return null;

  let applicationInvoices = (await getPaidApplicationInvoices(ctx, { partyApplicationId: partyApplication.id })) || [];

  const applicationsPaidInAnotherParty = personApplications.filter(pa => !applicationInvoices.some(ai => ai.personApplicationId === pa.id));

  const personIds = applicationsPaidInAnotherParty.map(app => app.personId);
  const applicationInvoicesPaidInAnotherParty = (await getPaidApplicationInvoices(ctx, { personIds })) || [];
  applicationInvoices = [...applicationInvoices, ...applicationInvoicesPaidInAnotherParty];

  const applicationTransactions = await getApplicationTransactionsByPersonApplicationIds(ctx, {
    personApplicationIds: uniq(applicationInvoices.map(pa => pa.personApplicationId)),
    types: [DALTypes.PaymentTransactionType.PAYMENT, DALTypes.PaymentTransactionType.REFUND, DALTypes.PaymentTransactionType.VOID],
  });

  return {
    personApplications: personApplications.filter(pa => pa.partyId === partyId),
    invoiceIdsPaidInAnotherParty: applicationInvoicesPaidInAnotherParty.map(ai => ai.id),
    applicationInvoices,
    applicationTransactions,
  };
};

export const getApplicationInvoices = async (ctx, partyId) => {
  logger.debug({ ctx, partyId }, 'getApplicationInvoices');

  const applicationPayments = await getApplicationPaymentsForParty(ctx, partyId);
  if (!applicationPayments) return [];

  const { personApplications, invoiceIdsPaidInAnotherParty, applicationInvoices, applicationTransactions } = applicationPayments;

  const paymentAccounts = await getPaymentTargetAccounts(ctx);
  const persons = await getPersonsByIds(
    ctx,
    personApplications.map(p => p.personId),
  );
  const applicantNames = personApplications.reduce((acc, item) => {
    acc[item.personId] = getDisplayName(persons.find(person => person.id === item.personId));
    return acc;
  }, {});

  const propertyId = await partyRepo.getAssignedPropertyByPartyId(ctx, partyId);
  const fees = await getFilteredFeesByLeaseState(ctx, propertyId, false);
  const transactions = [];

  await execConcurrent(applicationInvoices, async applicationInvoice => {
    const invoiceTransactions = applicationTransactions.filter(trans => trans.invoiceId === applicationInvoice.id);
    const transaction = await getTransactionObjectsFromInvoice(ctx.tenantId, {
      fees,
      applicantNames,
      applicationInvoice,
      invoiceTransactions,
      paymentAccounts,
    });

    return Array.prototype.push.apply(transactions, transaction);
  });

  return transactions.map(({ invoiceId, ...transaction }) => ({
    ...transaction,
    wasPaidInADifferentParty: invoiceIdsPaidInAnotherParty.some(id => id === invoiceId),
  }));
};

export const getAllApplicationStatusByPartyAndType = async (ctx, partyIds, { returnSsn = false, type }) => {
  logger.debug({ ctx, partyIds, type }, 'getAllApplicationStatusByPartyAndType');
  const applications = await partyRepo.getAllApplicationStatusByPartyAndType(ctx, partyIds, { returnSsn, type });

  return await execConcurrent(applications, async application => {
    const { id, partyId, personId } = application;
    const privateDocumentsCount = await getNumberOfDocumentsByPerson(ctx, partyId, personId);
    const { id: propertyId } = (await getPropertyForApplication(ctx, partyId, id)) || {};

    return {
      ...application,
      documents: { privateDocumentsCount },
      propertyId,
    };
  });
};

export const getPersonApplicationByPersonAndParty = async (ctx, personId, partyId) => await getPersonApplicationByFilter(ctx, personId, partyId);

export const getInvoiceForPersonApplication = async (ctx, personApplicationId) => {
  const invoiceFilter = { personApplicationId, paymentCompleted: true };
  const [applicationInvoice] = await getApplicationInvoicesByFilter(ctx, invoiceFilter);

  return applicationInvoice;
};

const logEntityForActivityLogs = async (ctx, { partyId, leaseTerm, quote, activityType }) => {
  const applicationSummary = await getApplicationSummaryForParty(ctx, partyId);
  const logEntry = {
    partyId,
    quoteId: quote.id,
    unit: quote.inventory.fullQualifiedName,
    leaseTerm: { termLength: leaseTerm.termLength, period: leaseTerm.period },
    ...(applicationSummary ? { applicationStatus: applicationSummary.applicationStatus } : {}),
    ...(applicationSummary ? { screeningStatus: applicationSummary.screeningStatus } : {}),
  };

  await logEntity(ctx, { entity: logEntry, activityType, component: COMPONENT_TYPES.APPLICATION });
};

const validateExistingLease = (ctx, leases, partyId, quotePromotion) => {
  const executedLeases = leases.filter(lease => lease.quoteId === quotePromotion.quoteId && lease.status === DALTypes.LeaseStatus.EXECUTED);
  if (executedLeases && executedLeases.length) {
    logger.error(
      { ctx, partyId, executedLeasesIds: executedLeases.map(executedLease => executedLease.id), quotePromotionId: quotePromotion.id },
      'Cannot demote application with an existing executed lease',
    );
    throw new ServiceError({ token: 'CANNOT_DEMOTE_APPLICATION', status: 412 });
  }
};

export const demoteApplication = async (ctx, partyId, quotePromotionId) => {
  logger.trace({ ctx, partyId, quotePromotionId }, 'demoteApplication');
  const quotePromotion = await partyRepo.loadQuotePromotion(ctx, quotePromotionId);
  if (!quotePromotion) {
    throw new ServiceError({ token: 'PROMOTED_QUOTE_NOT_FOUND', status: 412 });
  }
  const leases = await getPartyLeases(ctx, partyId);
  validateExistingLease(ctx, leases, partyId, quotePromotion);

  return await runInTransaction(async trx => {
    const newCtx = { ...ctx, trx };
    const quote = await getQuoteById(newCtx, quotePromotion.quoteId);
    const leaseTerm = quote.publishedQuoteData.leaseTerms.find(lt => lt.id === quotePromotion.leaseTermId);
    if (
      quotePromotion.promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL ||
      quotePromotion.promotionStatus === DALTypes.PromotionStatus.REQUIRES_WORK
    ) {
      logger.trace({ ctx, quotePromotion }, 'demoteApplication');
      await partyRepo.updateQuotePromotion(newCtx, quotePromotion.id, { promotionStatus: DALTypes.PromotionStatus.CANCELED });
      await logEntityForActivityLogs(ctx, { partyId, leaseTerm, quote, activityType: ACTIVITY_TYPES.REMOVE });
    } else if (quotePromotion.promotionStatus === DALTypes.PromotionStatus.APPROVED) {
      logger.trace({ ctx, quotePromotion, leaseIds: leases.map(lease => lease.id) }, 'demoteApplication of approved promotion');
      await logEntityForActivityLogs(newCtx, { partyId, leaseTerm, quote, activityType: ACTIVITY_TYPES.REVOKE });

      const leasesByQuote = leases.filter(
        lease => lease.quoteId === quotePromotion.quoteId && (lease.status === DALTypes.LeaseStatus.DRAFT || lease.status === DALTypes.LeaseStatus.SUBMITTED),
      );
      if (leasesByQuote && leasesByQuote.length) {
        await voidLease(newCtx, leasesByQuote[0].id);
      } else {
        logger.trace({ ctx, quotePromotion }, 'demoteApplication without leases');
        await partyRepo.updateQuotePromotion(newCtx, quotePromotion.id, { promotionStatus: DALTypes.PromotionStatus.CANCELED });
      }
    }
    // TODO break the circular reference properly

    await taskUtils.sendMessageToCancelNotifyConditionalApprovalTask(newCtx, partyId);

    await performPartyStateTransition(newCtx, partyId);

    const partyEvent = {
      partyId,
      userId: (ctx.authUser || {}).id,
    };

    await eventService.demoteApplicationEvent(newCtx, partyEvent);
  }, ctx);
};
