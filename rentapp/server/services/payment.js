/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';
import { mapSeries } from 'bluebird';
import get from 'lodash/get';
import * as service from '../../../auth/server/services/common-user';
import config from '../../../server/config';
import { addPartyMember, loadPartyById, loadPartyMembers, getPartyMembersById } from '../../../server/services/party';
import {
  saveApplicationTransactionUpdatedEvent,
  saveApplicationPaymentProcessedEvent,
  savePaymentReceivedEvent,
  savePersonApplicationInviteEvent,
} from '../../../server/services/partyEvent';

import { enhance, isPrimary, markAsPrimary, unmarkAsPrimary } from '../../../common/helpers/contactInfoUtils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now } from '../../../common/helpers/moment-utils';

import { createJWTToken } from '../../../common/server/jwt-helpers';
import { getPersonApplication, updatePersonApplicationData } from './person-application';

import loggerModule from '../../../common/helpers/logger';

import { getPersonById, getPersonByEmailAddress, updatePerson, validatePrimaryEmail } from '../../../server/services/person';

// TODO: RENTAPP SERVICES MAY NOT ACCESS RED DAL!!!
import { getQuoteById } from '../../../server/dal/quoteRepo';

import { existsApplicationInvoice } from '../dal/application-invoices-repo';

import * as provider from '../payment/payment-provider-integration';
import { existsApplicationTransaction, createApplicationTransaction } from './application-transactions';
import { getApplicationInvoice } from './application-invoices';
import { getPropertyToAssign, updateAssignedPropertyOnFirstPayment } from './property';
import eventTypes from '../../../common/enums/eventTypes';
import { notify } from '../../../common/server/notificationClient';

import { errorIfHasUndefinedValues } from '../../../common/helpers/validators';
import { assert } from '../../../common/assert';
import { getScreeningVersion } from '../helpers/screening-helper';
import { runInTransaction } from '../../../server/database/factory';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../../../server/helpers/message-constants';
import { sendMessage } from '../../../server/services/pubsub';
import { isEmailValid } from '../../../common/helpers/validations/email';
import { isPhoneValid } from '../../../common/helpers/validations/phone';
import { sendMessageToProcessPlaceInventoryOnHoldTask } from '../../../server/helpers/taskUtils';
import { generateEmailContext } from '../../../server/helpers/mails';
import { getInventoryHolds } from '../../../server/dal/inventoryRepo';
import { shouldInviteGuarantor } from '../../../common/helpers/applicants-utils';
import { getPartySettings } from '../../../server/services/party-settings';
import { validateUniqueEmail } from '../helpers/application-helper';
import { ScreeningVersion } from '../../../common/enums/screeningReportTypes';
import { personApplicationProvider } from '../providers/person-application-provider-integration';
import { sendInvitationsEmails } from '../../../server/services/mjmlEmails/applicationEmails';
import { loadUserById } from '../../../server/services/users';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import { holdInventory } from '../../../server/services/inventories';
import { getOnlyDigitsFromPhoneNumber } from '../../../common/helpers/phone-utils';
import { TARGET_ACCOUNT_TYPE, TARGET_ACCOUNT_NAME } from '../../common/enums/target-account-types';

const logger = loggerModule.child({ subType: 'paymentService' });

const addPartyMemberForInvite = async (ctx, data) => {
  const { partyId, isGuarantor, email, existingMembers } = data;
  const partyMemberToAdd = {
    memberType: isGuarantor ? DALTypes.MemberType.GUARANTOR : DALTypes.MemberType.RESIDENT,
    memberState: DALTypes.PartyStateType.APPLICANT,
    contactInfo: enhance([{ type: 'email', value: email }]),
    fullName: null,
    preferredName: null,
  };
  const person = await getPersonByEmailAddress(ctx, email);
  if (person) {
    partyMemberToAdd.personId = person.id;
  }
  try {
    const party = await loadPartyById(ctx, partyId);
    const innerCtx = {
      ...ctx,
      authUser: {
        id: party.userId, // we use the party owner in this particular case
      },
    };
    const partyMember = await addPartyMember(innerCtx, partyMemberToAdd, partyId);
    return partyMember;
  } catch (ex) {
    logger.warn({ ctx }, 'Payment Service - Adding new party member validation failed');
    return existingMembers.find(m => m.contactInfo && m.contactInfo.defaultEmail === partyMemberToAdd.contactInfo.defaultEmail);
  }
};

// TODO: move this out of payment!
const registerApplicant = async (ctx, { personId, email }) => {
  const { tenantId } = ctx;
  const commonUser = {
    personId,
    email,
    tenantId,
    applicationId: config.rentapp.hostname,
  };
  logger.trace(commonUser, 'registerApplicant');
  if (personId && !email) {
    // not sure if this condition is ever expected outside of tests, but...
    logger.trace('registerApplicant had no email -- looking up from personId');
    email = (await getPersonById(ctx, personId)).contactInfo.defaultEmail;
  }
  errorIfHasUndefinedValues(commonUser);
  const commonUserResult = await service.createCommonUser(ctx, commonUser);
  return commonUserResult;
};

const getScreeningVersionFromParty = async (ctx, party = {}) => {
  const { metadata: partyMetadata } = party;
  return partyMetadata?.screeningVersion || (await getScreeningVersion({ tenantId: ctx.tenantId, partyId: party.id }));
};

const processPayment = async (ctx, { personId, invoiceId, appFeeInvoice, holdDepositInvoice, propertyId, party }) => {
  const { tenantId } = ctx;
  logger.debug({ tenantId, personId, invoiceId, appFeeInvoice, holdDepositInvoice }, 'processPayment');
  const screeningVersion = await getScreeningVersionFromParty(ctx, party);
  const paymentCompleted = true;
  const screeningV2MockData = {
    personId,
    partyId: party.id,
  };
  const { personApplicationId } = await personApplicationProvider(screeningVersion).updateApplicationInvoice(
    ctx,
    {
      id: invoiceId,
      paymentCompleted,
      appFeeTransactionId: appFeeInvoice?.transactionId,
      holdDepositTransactionId: holdDepositInvoice?.transactionId,
    },
    screeningV2MockData,
  );
  logger.debug('processPayment invoice payment updated');

  const { partyApplicationId } = await personApplicationProvider(screeningVersion).getPersonApplicationById(ctx, personApplicationId);

  await updateAssignedPropertyOnFirstPayment(ctx, { partyApplicationId, propertyId, party });

  await personApplicationProvider(screeningVersion).completeApplicationPayment(ctx, personApplicationId, propertyId, paymentCompleted);

  logger.debug('processPayment application payment updated');
};

export const getPaymentDataForBuildToken = async (ctx, { invoiceId, party, personApplication, propertyId }) => {
  logger.trace({ ctx, invoiceId, partyId: party.id, personApplication, propertyId }, 'getPaymentDataForBuildToken');
  const screeningVersion = await getScreeningVersionFromParty(ctx, party);
  const invoice = await personApplicationProvider(screeningVersion).getApplicationInvoice(ctx, { id: invoiceId });

  const { quoteId } = invoice;
  const quote = quoteId ? await getQuoteById(ctx, quoteId) : {};
  const property = await getPropertyToAssign(ctx, { quote, party, propertyId });
  assert(property, 'getPaymentDataForBuildToken: property not found');

  const {
    personId,
    applicationData: { email },
  } = personApplication;
  const { commonUser, personMapping } = await registerApplicant(ctx, { personId, email });
  logger.debug({ ctx, commonUserId: commonUser.id, personMapping }, ' registered applicant');
  const { fullName } = commonUser;

  return {
    fullName,
    commonUser,
    personMapping,
    property,
    quote,
  };
};

const applicationDataToPersonAdapter = ({ dateOfBirth }) => ({
  dob: dateOfBirth,
});

const enhanceContactInfoWithApplicationPhone = (contactInfo, applicationPhone) => {
  const isPhoneInfo = ({ type }) => type === DALTypes.ContactInfoType.PHONE;
  const isPrimaryPhone = contact => isPhoneInfo(contact) && isPrimary(contact);
  const containsPhone = contact => contact.value === applicationPhone;

  const contactInfoList = contactInfo.all;
  if (contactInfoList.some(containsPhone)) return enhance(contactInfoList);

  const hasPrimaryPhone = contactInfoList.some(isPrimaryPhone);

  contactInfoList.push({
    id: newId(),
    value: applicationPhone.toLowerCase(),
    type: DALTypes.ContactInfoType.PHONE,
    isPrimary: !hasPrimaryPhone,
  });

  return enhance(contactInfoList);
};

const enhanceContactInfoWithApplicationEmail = (contactInfo, applicationEmail) => {
  const isEmailInfo = ({ type }) => type === DALTypes.ContactInfoType.EMAIL;
  const isPrimaryEmail = contact => isEmailInfo(contact) && isPrimary(contact);
  const contactInfoList = contactInfo.all.map(contact => {
    if (!isEmailInfo(contact)) return contact;

    return contact.value.toLowerCase() === applicationEmail.toLowerCase() ? markAsPrimary(contact) : unmarkAsPrimary(contact);
  });

  if (!contactInfoList.some(isPrimaryEmail)) {
    contactInfoList.push(
      markAsPrimary({
        id: newId(),
        value: applicationEmail.toLowerCase(),
        type: DALTypes.ContactInfoType.EMAIL,
      }),
    );
  }
  return enhance(contactInfoList);
};

export const updatePersonFromApplication = async (ctx, { personId, applicationData }) => {
  const { firstName = '', middleName = '', lastName = '' } = applicationData;

  logger.info({ ctx, personId, email: applicationData.email }, 'update person information');
  const personApplicationInfo = applicationDataToPersonAdapter(applicationData);
  const person = { ...(await getPersonById(ctx, personId)), ...personApplicationInfo };
  const isNameEmailOrPhone = person.fullName && (isEmailValid(person.fullName) || isPhoneValid(person.fullName));
  const shouldUpdateFullName = (!person.fullName || isNameEmailOrPhone) && firstName && lastName;

  if (isNameEmailOrPhone) {
    logger.error({ ctx, personId }, 'Person has an email or phone set as fullName/preferredName');
  }
  if (shouldUpdateFullName) {
    person.fullName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;
  }

  if (applicationData.phone) {
    const phone = getOnlyDigitsFromPhoneNumber(applicationData.phone);
    person.contactInfo = enhanceContactInfoWithApplicationPhone(person.contactInfo, phone);
  }

  person.contactInfo = enhanceContactInfoWithApplicationEmail(person.contactInfo, applicationData.email);

  logger.info({ person: person.contactInfo }, 'updating person');
  await updatePerson(ctx, personId, person);
};

export const sendRegistrationInviteEmails = async (ctx, emailInfo) => {
  const { tenantName, host, party, personApplication, quoteId, property, fullName, personMapping, commonUser, newMembersIds, templateNames } = emailInfo;
  const { userId } = party;
  assert(userId, 'sendRegistrationInviteEmails: party has no userId!');
  const personApplicationLog = applicationData => pick(applicationData, ['partyApplicationId', 'paymentCompleted', 'applicantId']);
  const partyMembers = await getPartyMembersById(ctx, newMembersIds);
  const partyId = party.id;

  logger.debug(
    {
      ctx,
      tenantName,
      host,
      partyId,
      personApplication: personApplicationLog(personApplication),
      quoteId,
      propertyId: property.id,
      fullName,
      userId,
      personMapping,
    },
    'sendRegistrationInviteEmails paymentData',
  );

  const emailContext = generateEmailContext(ctx, {
    tenantName,
    partyId,
    host,
    quoteId,
    property,
  });

  const emailSender = await loadUserById(ctx, userId);

  await sendInvitationsEmails(emailContext, {
    personApplication,
    partyId,
    quoteId,
    propertyId: property.id,
    fullName,
    partyMembers,
    templateNames,
    emailSender,
  });

  logger.debug({ ctx }, `got commonUser ${commonUser.id}`);
};

const notifyPayment = (ctx, paymentData) => {
  const { personMapping, party, fullName, quote, personApplication, property, partyApplicationId, personId } = paymentData;
  const personApplicationId = personApplication.id;
  const partyId = party.id;

  const token = createJWTToken({
    commonUserId: personMapping.commonUserId,
    personApplicationId,
    personId,
    personName: fullName,
    partyApplicationId,
    quoteId: quote.id,
    partyId,
    propertyId: property.id,
  });

  notify({
    ctx,
    event: eventTypes.PAYMENT_RECEIVED,
    data: { partyApplicationId, token, personApplicationId },
  });
};

export const sendPaymentProcessedMessage = async (ctx, partyId) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.PAYMENT_PROCESSED,
    message: { tenantId: ctx.tenantId, partyId },
    ctx,
  });

const saveInvitedResidentsGuarantors = async (ctx, personApplication, partyId) => {
  const { guarantors, otherApplicants } = personApplication.applicationData;
  const existingMembers = await loadPartyMembers(ctx, partyId);

  return await mapSeries(
    [
      ...otherApplicants.map(applicant => ({
        isGuarantor: false,
        email: applicant.text,
      })),
      ...guarantors.map(applicant => ({
        isGuarantor: true,
        email: applicant.text,
      })),
    ],
    applicant =>
      addPartyMemberForInvite(ctx, {
        ...applicant,
        existingMembers,
        partyId,
      }),
  );
};

const getHoldDepositPayer = (invoice, members = [], personApplication = {}) => members.find(member => member.personId === personApplication.personId) || {};

export const createPlaceInventoryHoldTask = async (ctx, partyId, invoice, quote, personApplication) => {
  logger.trace({ ctx, partyId }, 'Create place inventory hold task');
  if (!invoice.holdDepositFeeId) return;

  const members = await loadPartyMembers(ctx, partyId);

  if (!members || !members.length) {
    logger.error({ ctx, partyId }, 'No party members found for party');
    return;
  }

  const { preferredName = '', fullName = '' } = getHoldDepositPayer(invoice, members, personApplication);

  if (!quote || !quote.inventory) {
    await sendMessageToProcessPlaceInventoryOnHoldTask(ctx, partyId, { holdDepositPayer: { preferredName, fullName } });
    return;
  }

  const inventoryName = get(quote, 'inventory.name', '');
  const inventoryFullQualifiedName = get(quote, 'inventory.fullQualifiedName', '');
  const inventoryId = get(quote, 'inventory.id');
  const inventoryHolds = await getInventoryHolds(ctx, inventoryId);

  if (!inventoryHolds.length) {
    try {
      await holdInventory(ctx, {
        inventoryId,
        partyId,
        quotable: true,
        startDate: now().toDate(),
        reason: DALTypes.InventoryOnHoldReason.AUTOMATIC,
        skipExportToMRI: true,
        quoteId: quote.id,
      });
      await sendMessageToProcessPlaceInventoryOnHoldTask(ctx, partyId, {
        inventoryName,
        title: 'HOLD_INVENTORY_CONFIRM',
        isReassignable: true,
        isNotAutoclosing: true,
        holdDepositPayer: { preferredName, fullName },
        inventoryFullQualifiedName,
      });
    } catch (error) {
      logger.error({ ctx, inventoryId }, 'Error trying to hold the inventory');
    }
    return;
  }
  const doesInventoryHaveHoldForParty = inventoryHolds.some(inventoryHold => inventoryHold.partyId === quote.partyId);

  if (doesInventoryHaveHoldForParty) {
    await sendMessageToProcessPlaceInventoryOnHoldTask(ctx, partyId, {
      inventoryName,
      title: 'HOLD_INVENTORY_CONFIRM',
      isReassignable: true,
      isNotAutoclosing: true,
      holdDepositPayer: { preferredName, fullName },
      inventoryFullQualifiedName,
    });
  } else {
    await sendMessageToProcessPlaceInventoryOnHoldTask(ctx, partyId, { holdDepositPayer: { preferredName, fullName } });
  }
  return;
};

const updatePersonApplicationWithGuarantorsValidated = async (ctx, personApplicationId) => {
  const personApplication = await personApplicationProvider(ctx.screeningVersion).getPersonApplicationById(ctx, personApplicationId);

  if (ctx.screeningVersion === ScreeningVersion.V2) {
    return personApplication;
  }

  // TODO: CPM-12483 implement code below for screening V2
  const { partyId, personId, applicationData } = personApplication;
  const members = await loadPartyMembers(ctx, partyId);
  const {
    traditional: { residentOrPartyLevelGuarantor },
  } = await getPartySettings(ctx);
  const guarantors = shouldInviteGuarantor(members, personId, residentOrPartyLevelGuarantor) ? applicationData.guarantors : [];
  const applicationDataUpdated = { ...applicationData, guarantors };

  if (!isEqual(applicationData.guarantors, applicationDataUpdated.guarantors)) {
    logger.trace({ ctx, personApplicationId }, 'About to update Application Data after payment');
    await updatePersonApplicationData(ctx, personApplicationId, applicationDataUpdated);
  }
  return { ...personApplication, applicationData: applicationDataUpdated };
};

export const processUnparsedPayment = async paymentNotification => {
  const ctx = { ...paymentNotification };
  logger.debug({ ctx, paymentNotification }, 'processing unparsed payment notification');

  // TODO: CPM-12483 extracting this from notification message to be able to mock the invoice for screening V2
  const { personApplicationId: applicationId, propertyId: applicationPropertyId } = paymentNotification;

  const { tenantId, invoiceId, tenantName, host, appFeeInvoice, holdDepositInvoice } = await provider.parsePaymentNotification({
    ...paymentNotification,
  });
  ctx.tenantId = tenantId;

  // TODO: CPM-12483 get party or use personApplication so we don't fetch from tenant metadata
  const screeningVersion = await getScreeningVersion({ tenantId });
  const invoice = await personApplicationProvider(screeningVersion).getApplicationInvoice(
    ctx,
    { id: invoiceId },
    { personApplicationId: applicationId, propertyId: applicationPropertyId },
  );

  if (!invoice) {
    logger.error({ paymentNotification, invoiceId }, 'processUnparsedPayment Unable to find invoice!');
    throw Error('INVOICE_ID_NOT_EXISTS');
  }
  logger.trace({ ctx, personApplicationInvoice: invoice }, 'processUnparsedPayment fetched invoice');

  const { personApplicationId, propertyId } = invoice;
  const personApplication = await updatePersonApplicationWithGuarantorsValidated({ ...ctx, screeningVersion }, personApplicationId);

  const { partyId, personId, partyApplicationId, applicationData } = personApplication;
  logger.trace({ ctx, personId, partyId, partyApplicationId }, 'processUnparsedPayment fetched personApplication Data');
  await validateUniqueEmail(ctx, applicationData.email, personId);
  await validatePrimaryEmail(ctx, personId, applicationData.email);
  logger.trace({ ctx, partyId, personId, partyApplicationId }, 'processUnparsedPayment about to load party');
  const party = await loadPartyById(ctx, partyId);
  assert(party, 'processUnparsedPayment: party not found');

  let newMembers = [];
  try {
    await runInTransaction(async trx => {
      const innerCtx = { ...ctx, trx };

      logger.trace({ ctx, partyId, personId, partyApplicationId }, 'processUnparsedPayment about to update person from app');
      await updatePersonFromApplication(innerCtx, { personId, applicationData });
      logger.trace({ ctx, partyId, personId, partyApplicationId }, 'processUnparsedPayment about to save invited guarantors');
      newMembers = await saveInvitedResidentsGuarantors(innerCtx, personApplication, partyId);
      logger.trace({ ctx, partyId, personId, partyApplicationId }, 'processUnparsedPayment about to processPayment');
      await processPayment(innerCtx, {
        personId,
        personApplicationId,
        partyApplicationId,
        appFeeInvoice,
        holdDepositInvoice,
        invoiceId,
        propertyId,
        party,
      });
      logger.trace({ ctx, partyId, personId, partyApplicationId }, 'processUnparsedPayment about to send paymentProcessed message');

      await sendPaymentProcessedMessage(innerCtx, partyId);
    });
  } catch (e) {
    logger.error({ e, paymentNotification }, 'error on process payment');
    throw e;
  }

  try {
    const { personMapping, fullName, property, commonUser, quote } = await getPaymentDataForBuildToken(ctx, {
      invoiceId,
      party,
      personApplication,
      propertyId,
    });

    const paymentData = {
      tenantName,
      host,
      personMapping,
      party,
      fullName,
      quote,
      personApplication,
      property,
      partyApplicationId,
      personId,
      commonUser,
      newMembers,
    };

    logger.trace({ ctx, partyId, personId, partyApplicationId }, 'processUnparsedPayment about to notifyPayment');
    await notifyPayment(ctx, paymentData);
    await createPlaceInventoryHoldTask(ctx, partyId, invoice, quote, personApplication);
    logger.trace({ ctx, partyId, personId, partyApplicationId }, 'processUnparsedPayment about to sendRegistrationInviteEmails');

    await saveApplicationPaymentProcessedEvent(ctx, {
      partyId,
      metadata: { appFeeInvoice: appFeeInvoice || {}, holdDepositInvoice: holdDepositInvoice || {}, personId, applicationId: personApplication.id },
    });

    await savePaymentReceivedEvent(ctx, { partyId, metadata: { invoiceId, host, tenantName, tenantId, commonUserHasPassword: !!commonUser.password } });
    if (newMembers.length) {
      await savePersonApplicationInviteEvent(ctx, {
        partyId,
        metadata: {
          host,
          tenantName,
          personMapping,
          fullName,
          quoteId: quote?.id || null,
          personId,
          commonUser: {
            id: commonUser?.id,
            email: commonUser?.email,
            fullName: commonUser?.fullName,
            anonymousEmailId: commonUser?.anonymousEmailId,
          },
          property: {
            id: property?.id || null,
            displayName: property.displayName,
            address: {
              addressLine1: property.address.addressLine1,
              city: property.address.city,
              state: property.address.state,
            },
          },
          personApplication: {
            id: personApplication?.id || null,
            personId: personApplication?.personId || null,
            paymentCompleted: personApplication?.paymentCompleted,
            partyApplicationId: personApplication?.partyApplicationId || null,
            applicationData: personApplication?.applicationData,
            applicantId: personApplication?.applicantId || null,
          },
          newMembersIds: newMembers.map(partyMember => partyMember.id),
        },
      });
    }
  } catch (err) {
    logger.error(
      {
        ctx,
        err,
        partyId,
        personId,
        partyApplicationId,
        paymentNotification,
      },
      'processUnparsedPayment error on additional logic for payment',
    );
  }
};

const convertDalTypeToAptexx = type => `${type.toLowerCase()}s`;

const saveApplicationTransaction = async (ctx, transaction, isRefund, isReversal) =>
  await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };

    const result = await createApplicationTransaction(innerCtx, transaction);

    const invoice = await getApplicationInvoice(innerCtx, { id: transaction.invoiceId });
    const { personApplicationId } = invoice;
    const { partyId } = await getPersonApplication(innerCtx, personApplicationId);
    await saveApplicationTransactionUpdatedEvent(innerCtx, { partyId, metadata: { transactionId: result.id, isRefund, isReversal } });
    logger.info({ ctx: innerCtx, id: result.id }, 'created application transaction');
  });

const storeTransactions = async (ctx, targetId, transactionType, transactions = []) => {
  logger.info({ ctx, targetId, transactionType, transactionRecords: transactions.length }, `processing ${transactionType} transactions`);
  if (!(transactions && transactions.length)) return;

  const isReversal = DALTypes.PaymentTransactionType.REVERSAL === transactionType;
  const isRefund = DALTypes.PaymentTransactionType.REFUND === transactionType;
  for (let i = 0; i < transactions.length; i++) {
    const externalId = (!isReversal && transactions[i].id) || transactions[i].refId;
    const transaction = {
      invoiceId: transactions[i].integrationId,
      transactionData: transactions[i],
      externalId,
      transactionType,
      targetId,
    };

    try {
      const { transactionData, ...integrationData } = transaction;
      logger.info({ ctx, integrationData }, `checking ${transactionType} transaction`);
      if (!(await existsApplicationInvoice(ctx, transaction.invoiceId))) return;
      if (await existsApplicationTransaction(ctx, transaction)) return;
      logger.info({ ctx, transaction: transactions[i], transactionIdx: i }, `${transactionType} transaction`);
      await saveApplicationTransaction(ctx, transaction, isRefund, isReversal);
    } catch (error) {
      logger.error({ error, ctx, transaction }, 'Error saving transaction');
    }
  }
};

const getTransactionsByType = (ctx, transactions, transactionType) => {
  const transactionForType = transactions[convertDalTypeToAptexx(transactionType)] || [];
  return transactionForType.filter(({ groupIntegrationId }) => groupIntegrationId === ctx.tenantId);
};

export const storeGivenTransactions = async (ctx, providerTransactions) => {
  logger.trace({ ctx }, 'storeGivenTransactions');

  for (let i = 0; i < providerTransactions.length; i++) {
    const { targetId, transactions } = providerTransactions[i];

    if (transactions) {
      logger.info({ ctx, targetId }, `transactions for ${targetId}`);

      await execConcurrent(
        Object.values(DALTypes.PaymentTransactionType),
        async type => await storeTransactions(ctx, targetId, type, getTransactionsByType(ctx, transactions, type)),
      );
    } else {
      logger.error({ ctx, targetId }, `Error fetching transactions for ${targetId}`);
    }
  }
};

const processUnparsedPayments = async (ctx, providerTransactions) => {
  logger.trace({ ctx, providerTransactions }, 'processUnparsedPayments from received transactions');

  const reducedPaymentTransactions = providerTransactions?.reduce((acc, row) => {
    const { targetId, transactions } = row;
    transactions?.payments?.forEach(payment => {
      acc.push({ targetId, payment });
    });
    return acc;
  }, []);

  await mapSeries(reducedPaymentTransactions, async paymentTransaction => {
    if (paymentTransaction.payment) {
      const { targetId, payment } = paymentTransaction;
      logger.trace({ ctx, targetId, payment }, 'payment received');

      const { tenantId } = ctx;
      const { integrationId: invoiceId } = payment;
      const invoiceData = await getApplicationInvoice(ctx, { id: invoiceId });
      if (invoiceData) {
        const { partyApplicationId, personApplicationId, propertyId, paymentCompleted } = invoiceData;
        if (!paymentCompleted) {
          const msg = {
            tenantId,
            invoiceId,
            personApplicationId,
            partyApplicationId,
            propertyId,
          };
          logger.trace({ ctx, msg }, 'sending message to processUnparsedPayment');
          await processUnparsedPayment(msg);
        }
      } else {
        logger.error({ ctx, invoiceId }, 'unable to find an invoice');
      }
    }
  });
};

/**
 * fetch and store all transactions for a given date range. Transaction types include payments, declines, voids, refunds, and reversals
 * @param {string} tenantId: tenant id
 */
export const fetchAndStoreTransactions = async ctx => {
  logger.info({ ctx }, 'getTransactions call');
  const providerTransactions = await provider.getTransactions(ctx, {
    targetTypeFilters: [TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.HOLD_ACCOUNT], TARGET_ACCOUNT_NAME[TARGET_ACCOUNT_TYPE.APPLICATION_ACCOUNT]],
  });
  await processUnparsedPayments(ctx, providerTransactions);
  await storeGivenTransactions(ctx, providerTransactions);
};
