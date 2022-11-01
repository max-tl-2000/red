/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import orderBy from 'lodash/orderBy';

import { ExportType } from './export';
import { getPartyData, getCompanyName, isPartyInApplicantState, getAppointmentInventory } from '../common-export-utils';
import { getPartyMemberByPersonId, getExternalInfo, generateGuestCardsExportSteps, processExportMessage } from './mri-export-utils';
import { getExternalIdsForUser } from '../../services/users';
import { getAllExternalInfoByPartyForMRI, updateExternalInfoExportData } from '../../dal/exportRepo';
import { getPaymentTargetAccountsForProperty } from '../../../rentapp/server/payment/payment-provider-integration';

import { shouldExportExternalUniqueId } from '../helpers';
import { getFeeById } from '../../dal/feeRepo';
import { getInventoryExpanded, getInventoryHolds } from '../../services/inventories';

import loggerModule from '../../../common/helpers/logger';
import { getInventoryProps, updateInventoryOnHoldByPartyIdAndInvId } from '../../dal/inventoryRepo';
import { getAvailabilityDate } from '../../../common/helpers/inventory';
import { getPrimaryExternalIdToClearUnit } from './exportMriUnitHeld';
import { DALTypes } from '../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'export/mri' });

const getInvoiceData = (ctx, partyDocument, personApplicationId) => {
  logger.trace({ ctx, partyId: partyDocument.id, personApplicationId }, 'getInvoiceData - MRI');
  const { personApplications, invoices = [] } = partyDocument;

  const personApplication = personApplications.find(pa => pa.id === personApplicationId);
  if (personApplication.isFeeWaived) return null;

  const invoicesForApplication = invoices.filter(inv => inv.personApplicationId === personApplicationId);
  const sortedInvoices = orderBy(invoicesForApplication, 'created_at', 'desc');

  const [invoice] = sortedInvoices;
  return {
    invoiceId: invoice.id,
    applicationFeeAmount: invoice.applicationFeeAmount,
    applicationFeeWaiverAmount: invoice.applicationFeeWaiverAmount,
  };
};

const savePaymentData = async (ctx, partyDocument, externalInfo, applicationId) => {
  logger.trace({ ctx, partyId: partyDocument.id, applicationId }, 'savePaymentData');

  const invoiceData = getInvoiceData(ctx, partyDocument, applicationId);
  const { exportData = {} } = externalInfo.metadata;
  const { payments = [] } = exportData;

  const updatedPayments = [...payments, invoiceData].filter(x => x);

  await updateExternalInfoExportData(ctx, externalInfo.id, { ...exportData, payments: updatedPayments });
};

export const getData = async (ctx, partyDocument, appFeeInvoice, holdDepositInvoice, personId) => {
  logger.info({ ctx, partyId: partyDocument.id, appFeeInvoice, holdDepositInvoice, personId }, 'Export MRI - getting data for ApplicationPayment export');

  const { invoices } = partyDocument;
  const appFeeTransactionId = appFeeInvoice?.transactionId?.toString();
  const holdDepositTransactionId = holdDepositInvoice?.transactionId?.toString();
  const invoice = invoices.find(
    i =>
      (appFeeTransactionId && i.appFeeTransactionId === appFeeTransactionId) ||
      (holdDepositTransactionId && i.holdDepositTransactionId === holdDepositTransactionId),
  );

  const quote = invoice && partyDocument.quotes && partyDocument.quotes.find(q => q.id === invoice.quoteId && q.publishedQuoteData);
  const application = invoice && partyDocument.personApplications.find(pa => pa.id === invoice.personApplicationId);

  const partyData = await getPartyData(ctx, partyDocument);
  const { primaryTenant, externalInfo, party } = await getExternalInfo(ctx, partyDocument);
  const externals = await getAllExternalInfoByPartyForMRI(ctx, partyDocument.id, partyDocument.assignedPropertyId);

  const companyName = getCompanyName(partyDocument, primaryTenant.id);

  const firstAppointmentInventory = partyDocument?.metadata?.appointmentInventory;
  const externalIds = await getExternalIdsForUser(ctx, partyDocument.ownerTeam, partyDocument.userId);

  const partyMember = getPartyMemberByPersonId(partyDocument, personId, false);
  const shouldExportExternalUniqueIdForAgent = await shouldExportExternalUniqueId(ctx, partyDocument.ownerTeam, partyDocument.userId);

  const applicationFeeAmount = invoice ? invoice.applicationFeeAmount - Number(invoice.applicationFeeWaiverAmount) : 0;
  const holdDepositAmount = invoice ? invoice.holdDepositFeeIdAmount : 0;
  const fee = invoice && (await getFeeById(ctx, invoice.holdDepositFeeId));
  const holdDepositSecurityCode = fee && fee.externalChargeCode;

  const targetAccounts = await getPaymentTargetAccountsForProperty(ctx, partyDocument.assignedPropertyId);
  const isApplicationFeeTransaction = appFeeInvoice && !!targetAccounts.applicationAccounts.find(account => +account === appFeeInvoice.targetId);
  const isHoldDepositTransaction = holdDepositInvoice && !!targetAccounts.holdAccounts.find(account => +account === holdDepositInvoice.targetId);
  const propertyHasHoldDepositAccount = targetAccounts.holdAccounts.some(acc => !!acc);
  const inventory = quote && quote.inventoryId && (await getInventoryExpanded(ctx, quote.inventoryId));
  const inventoryProps = inventory && (await getInventoryProps(ctx, { inventoryId: inventory.id }));
  const inventoryAvailabilityDate = inventoryProps && getAvailabilityDate(inventoryProps, partyData.property.timezone);
  const inventoryOnHolds = inventory && (await getInventoryHolds(ctx, inventory.id));
  const inventoryOnHoldForAnotherParty = inventoryOnHolds && inventoryOnHolds.find(hold => hold.partyId !== partyDocument.id);
  const partyShouldBeExportedAsApplicant = isPartyInApplicantState(invoices);

  if (application) {
    await savePaymentData(ctx, partyDocument, externalInfo, application.id);
  }

  return {
    tenantId: ctx.tenantId,
    primaryTenant,
    partyMember,
    ...partyData,
    party,
    companyName,
    appointmentInventory: await getAppointmentInventory(ctx, firstAppointmentInventory, partyData),
    userExternalUniqueId: externalIds.externalUniqueId,
    teamMemberExternalId: externalIds.externalId,
    application: pick(application, ['paymentCompleted', 'personId']),
    appFeeInvoice,
    holdDepositInvoice,
    shouldExportExternalUniqueIdForAgent,
    applicationFeeAmount,
    holdDepositAmount,
    holdDepositSecurityCode,
    isApplicationFeeTransaction,
    isHoldDepositTransaction,
    propertyHasHoldDepositAccount,
    externalInfo,
    externals,
    inventoryAvailabilityDate,
    inventory: inventory && {
      ...pick(inventory, ['itemType', 'itemId', 'name', 'externalId', 'id']),
      building: pick(inventory.building, ['externalId']),
      property: pick(inventory.property, ['externalId']),
    },
    leaseTermLength: quote && quote.publishedQuoteData.leaseTerms[0].termLength,
    inventoryOnHoldForAnotherParty,
    quote: quote && {
      leaseStartDate: quote.leaseStartDate,
    },
    partyShouldBeExportedAsApplicant,
  };
};

export const getExportSteps = async (ctx, partyDocument, exportEvent, data) => {
  const steps = await generateGuestCardsExportSteps(ctx, partyDocument, data);

  if (data.isApplicationFeeTransaction && data.applicationFeeAmount > 0) {
    steps.push(ExportType.ApplicationPayment);
  }

  const shouldExportHoldDeposit =
    data.holdDepositAmount && (data.isHoldDepositTransaction || (data.isApplicationFeeTransaction && !data.propertyHasHoldDepositAccount));

  if (shouldExportHoldDeposit) {
    steps.push(ExportType.ApplicationDepositPayment);

    if (data.inventory && !data.inventoryOnHoldForAnotherParty) {
      steps.push(ExportType.ClearSelectedUnit);
      steps.push(ExportType.SelectUnit);
      const { inventory, externals, primaryTenant, party } = data;
      const updatedInventory = await updateInventoryOnHoldByPartyIdAndInvId(ctx, {
        inventoryId: inventory.id,
        partyId: party.id,
        partyMemberId: primaryTenant.id,
        assignedPropertyId: partyDocument.assignedPropertyId,
      });

      data.primaryExternalIdForClearUnit = getPrimaryExternalIdToClearUnit(partyDocument, {
        primaryTenant,
        externals,
        updatedInventory,
        isUnitReleased: false,
        inventoryId: inventory.id,
      });
    }
  }

  return steps.map((value, index) => ({
    index,
    ...value,
  }));
};

export const exportMriApplicationPayment = async (ctx, partyDocument, exportEvent, extraPayload) => {
  try {
    const { appFeeInvoice, holdDepositInvoice, personId } = exportEvent.metadata;
    logger.info({ ctx, partyId: partyDocument.id, appFeeInvoice, holdDepositInvoice, exportEvent }, 'Export MRI - starting export on application payment');

    const data = await getData(ctx, partyDocument, appFeeInvoice, holdDepositInvoice, personId);
    const exportSteps = await getExportSteps(ctx, partyDocument, exportEvent, data);

    await processExportMessage(ctx, {
      partyId: partyDocument.id,
      data,
      exportSteps,
      extraPayload,
      mriExportAction: DALTypes.MriExportAction.APPLICATION_PAYMENT,
    });
  } catch (error) {
    logger.error({ ctx, error, partyId: partyDocument.id }, 'Export MRI - application payment - error');
    throw error;
  }
};
