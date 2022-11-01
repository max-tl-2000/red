/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import { DALTypes } from '../../../common/enums/DALTypes';
import { runInTransaction } from '../../database/factory';
import { getFeeById } from '../../services/fees';
import { getInventoryById } from '../../dal/inventoryRepo';
import { toMoment } from '../../../common/helpers/moment-utils';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { setPrimaryTenant } from '../../services/export';
import { loadPartyById } from '../../services/party';
import { archiveExternalInfo, saveExternalPartyMemberInfo } from '../../services/externalPartyMemberInfo';
import {
  getExternalInfoByLeaseId,
  getPrimaryExternalInfoByParty,
  getPrimaryExternalInfoByPartyAndProperty,
  getActiveExternalInfoByParty,
  getArchivedExternalInfoByPartyForProperty,
  getNextPrimaryTenantCode,
  getNextProspectCode,
} from '../../dal/exportRepo';
import { didPropertyChange, getInventoryOnHold } from '../common-export-utils';
import { getPartyMemberIdByPartyIdAndPersonId } from '../../dal/partyRepo';
import { getPropertyById } from '../../dal/propertyRepo';
import { getActiveLeasePartyIdBySeedPartyAndLeaseId } from '../../dal/activeLeaseWorkflowRepo';
import { exportData, ExportType } from './export.js';
import { getInventoryToExport } from './dataGathering';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

export const OccupantType = {
  None: 0,
  Adult: 1,
  Minor: 2,
};

const getFee = async (ctx, feeId, feesArray) => {
  if (!feeId) return {};
  const fee = feesArray ? feesArray.find(f => f.id === feeId) : await getFeeById(ctx, feeId);
  return fee || {};
};

const validateEmptyFields = (externalData, type) => {
  const emptyFields = Object.keys(externalData).filter(field => !externalData[field]);
  emptyFields.length > 0 && logger.error({ emptyFields }, `empty values for external ${type} fields`);
};

export const formatExportEntry = exportEntries => ({
  offset: exportEntries.OFFSET,
  notes: exportEntries.NOTES,
  ref: exportEntries.REF,
  account: exportEntries.ACCOUNT,
  accrual: exportEntries.ACCRUAL,
});

export const getChargeExternalData = async (ctx, feeId, fees) => {
  logger.trace({ ctx, feeId, fees }, 'getChargeExternalData');

  const fee = await getFee(ctx, feeId, fees);
  const chargeData = {
    offset: fee.externalChargeCode,
    notes: fee.externalChargeNotes,
    ref: fee.externalChargeRef,
    account: fee.externalChargeAccount,
    accrual: fee.externalChargeAccrualAccount,
  };

  validateEmptyFields(chargeData, 'charge');
  return chargeData;
};

export const getWaivedChargeExternalData = async (ctx, feeId, invoiceAmount) => {
  logger.trace({ ctx, feeId, invoiceAmount }, 'getWaivedChargeExternalData');

  const fee = await getFee(ctx, feeId);

  const chargeData = {
    offset: fee.externalChargeCode,
    notes: fee.externalChargeNotes,
    ref: fee.externalChargeRef,
    account: fee.externalChargeAccount,
    accrual: fee.externalChargeAccrualAccount,
    amount: invoiceAmount,
  };

  const waiverData = {
    offset: fee.externalWaiverOffset,
    notes: fee.externalWaiverNotes,
    ref: fee.externalWaiverRef,
    account: fee.externalWaiverAccount,
    accrual: fee.externalWaiverAccrualAccount,
    amount: invoiceAmount * -1, // Waiver amounts need to be negative for Maximus, this will be determined dynamically per customer in the future (see CPM-11113)
  };

  validateEmptyFields(chargeData, 'charge');
  validateEmptyFields(waiverData, 'charge');

  return [chargeData, waiverData];
};

export const getReceiptExternalData = async (ctx, feeId, fees) => {
  logger.trace({ ctx, feeId, fees }, 'getReceiptExternalData');

  const fee = await getFee(ctx, feeId, fees);
  const externalData = {
    offset: fee.externalReceiptOffset,
    notes: fee.externalReceiptNotes,
    ref: fee.externalReceiptRef,
    account: fee.externalReceiptAccount,
    accrual: fee.externalReceiptAccrualAccount,
  };
  validateEmptyFields(externalData, 'receipt');
  return externalData;
};

export const enhanceTransactionData = async transaction => {
  const { transactionData = {} } = transaction;
  const { amount, createdOn } = transactionData;
  const incomeDirection = -1;
  return {
    ...transactionData,
    date: toMoment(createdOn).toDate(), // TODO: ask Avantica: Why do we need toDate() ?? the moment instance should be enough
    amount: incomeDirection * (amount / 100),
  };
};

const getApplicationCharges = async (ctx, isFeeWaived, invoice, applicationFeeId) => {
  logger.trace({ ctx, isFeeWaived, invoice, applicationFeeId }, 'getApplicationCharges');

  if (isFeeWaived) {
    const waiverData = await getWaivedChargeExternalData(ctx, applicationFeeId, invoice.applicationFeeAmount);
    return waiverData.map(data => ({
      date: invoice.updated_at,
      ...data,
    }));
  }

  return [
    {
      amount: invoice.applicationFeeAmount,
      date: invoice.updated_at,
      ...(await getChargeExternalData(ctx, applicationFeeId)),
    },
  ];
};

export const getFinCharges = async (ctx, invoice, transaction = {}) => {
  logger.trace({ ctx, invoice, transaction }, 'getFinCharges');

  const { applicationFeeId, holdDepositFeeId, applicationFeeWaiverAmount } = invoice;

  if (transaction && transaction.targetId) {
    const { amount, date } = transaction;
    return [
      {
        amount,
        date,
        ...(await getChargeExternalData(ctx, applicationFeeId || holdDepositFeeId)),
      },
    ];
  }

  const isFeeWaived = !!applicationFeeWaiverAmount;
  const finCharges = await getApplicationCharges(ctx, isFeeWaived, invoice, applicationFeeId);

  if (holdDepositFeeId) {
    const holdDepositChargeData = {
      amount: invoice.holdDepositFeeIdAmount,
      date: invoice.updated_at,
      ...(await getChargeExternalData(ctx, holdDepositFeeId)),
    };
    return [...finCharges, holdDepositChargeData];
  }

  return finCharges;
};

export const getFinReceipts = async (ctx, invoice, transaction = {}) => {
  logger.trace({ ctx, invoice, transaction }, 'getFinReceipts');

  const { applicationFeeId, holdDepositFeeId } = invoice;
  if (transaction && transaction.targetId) {
    const { amount, date } = transaction;
    return [
      {
        amount,
        date,
        ...(await getReceiptExternalData(ctx, applicationFeeId)),
      },
    ];
  }

  const applicationFee = {
    amount: invoice.applicationFeeAmount,
    waiver: invoice.applicationFeeWaiverAmount,
    date: invoice.updated_at,
    ...(await getReceiptExternalData(ctx, applicationFeeId)),
  };

  const holdDepositFee = holdDepositFeeId
    ? { amount: invoice.holdDepositFeeIdAmount, date: invoice.updated_at, ...(await getReceiptExternalData(ctx, holdDepositFeeId)) }
    : {};

  return [applicationFee, holdDepositFee].filter(fee => fee?.amount && !fee?.waiver);
};

export const getFirstInventoryByAppointment = async (ctx, partyDocument, appointmentId) => {
  logger.trace({ ctx, partyId: partyDocument.id, appointmentId }, 'getFirstInventoryByAppointment');

  const appointment = (partyDocument.tasks || []).find(t => t.id === appointmentId);

  if (!appointment) {
    logger.error({ ctx, appointmentId }, 'Cannot find appointment in the party document');
    return null;
  }

  const [inventoryId] = appointment.metadata.inventories || [];
  if (!inventoryId) return null;

  return await getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });
};

const insertExternalPartyMemberInfoForYardiActiveLease = async (ctx, externalInfo) => {
  logger.trace({ ctx, externalInfo }, 'Insert external party member for active lease');

  const { partyId, externalId, leaseId, externalProspectId, personId, propertyId } = externalInfo;

  const { activeLeasePartyId } = (await getActiveLeasePartyIdBySeedPartyAndLeaseId(ctx, partyId, leaseId)) || {};

  if (!activeLeasePartyId) return;

  const partyMemberId = await getPartyMemberIdByPartyIdAndPersonId(ctx, { partyId: activeLeasePartyId, personId });
  partyMemberId &&
    (await saveExternalPartyMemberInfo(ctx, {
      partyMemberId,
      partyId: activeLeasePartyId,
      externalId,
      leaseId,
      propertyId,
      externalProspectId,
      isPrimary: true,
    }));
};

export const insertExternalPartyMemberInfoForPrimaryMember = async (ctx, { party, lease, primaryTenant, propertyId }) => {
  logger.info({ ctx, partyId: party.id, partyMemberId: primaryTenant.id }, 'insertExternalPartyMemberInfoForPrimaryMember');

  const externalId = await getNextPrimaryTenantCode(ctx);
  const externalProspectId = await getNextProspectCode(ctx);

  const leaseExternalInfo = await saveExternalPartyMemberInfo(ctx, {
    partyId: party.id,
    leaseId: lease?.id,
    externalId,
    propertyId,
    externalProspectId,
    partyMemberId: primaryTenant.id,
    isPrimary: true,
  });

  await insertExternalPartyMemberInfoForYardiActiveLease(ctx, {
    partyId: party.id,
    externalId,
    leaseId: lease?.id,
    externalProspectId,
    personId: primaryTenant.personId,
    propertyId,
  });

  return leaseExternalInfo;
};

export const findAndEnhancePrimaryTenant = async (partyDocument, externalInfo) => {
  const primaryPartyMember = partyDocument.members.find(pm => pm.partyMember.id === externalInfo?.partyMemberId);
  const enhanced = primaryPartyMember && (await enhance(primaryPartyMember.contactInfo));
  return {
    ...primaryPartyMember.partyMember,
    fullName: primaryPartyMember.person.fullName,
    contactInfo: enhanced,
  };
};

export const computeExternalInfo = async (
  ctx,
  { partyDocument, leaseId = null, includeArchivedParties = false, inventory = null, isForReassignedPropertyExport = null, isForVoidLeaseExport = null },
) => {
  const partyId = partyDocument.id;
  logger.trace({ ctx, partyId, leaseId }, 'getExternalInfo');

  const party = await loadPartyById(ctx, partyId);

  const propertyChanged = await didPropertyChange(ctx, partyId, inventory?.property?.id);

  if (partyDocument.leaseType === DALTypes.PartyTypes.TRADITIONAL && inventory?.property?.id && propertyChanged && !isForReassignedPropertyExport) {
    // this means that the export determined that the party for which the export should be run is
    // a different property than the one which is currently on the party.
    logger.info(
      { ctx, partyId, partyAssignedPropertyId: party.assignedPropertyId, inventoryPropertyId: inventory?.property?.id },
      'Yardi Export - Property changed for the party',
    );

    // if a property change occured, then we will do the following:
    // If we need to export for a property where we have no records in the EPMI table, we will create new records.

    // If we need to export for a property where we have older / archived records in the EPMI table, we will create
    // new records with the same t-codes / p-codes as the archived ones.

    // If we need to export for a property where we have current records in the EPMI table, we will use those records.
    await runInTransaction(async trx => {
      const innerCtx = { ...ctx, trx };

      const oldExternalInfoRecordsForProperty = await getArchivedExternalInfoByPartyForProperty(innerCtx, partyId, inventory.property.id);
      const prevExternalInfo = await getActiveExternalInfoByParty(innerCtx, { partyId });
      await mapSeries(prevExternalInfo, async externalInfo => await archiveExternalInfo(innerCtx, externalInfo));

      await mapSeries(oldExternalInfoRecordsForProperty, async externalInfo => {
        await saveExternalPartyMemberInfo(innerCtx, {
          ...externalInfo,
          endDate: null,
        });
      });
    });
  }

  const propertyId = inventory?.property?.id || party.assignedPropertyId;

  // setPrimaryTenant receives partyMembers in 'partyRepo' format
  await setPrimaryTenant(ctx, {
    partyId,
    partyMembers: partyDocument.members.map(m => m.partyMember),
    partyMemberId: null,
    includeArchivedParties,
    propertyId,
  });

  let externalInfo =
    (leaseId && (await getExternalInfoByLeaseId(ctx, leaseId, includeArchivedParties))) ||
    (await getPrimaryExternalInfoByPartyAndProperty(ctx, partyId, propertyId, null, includeArchivedParties));

  if (!externalInfo && party.leaseType === DALTypes.PartyTypes.CORPORATE && propertyChanged && !isForVoidLeaseExport) {
    const otherPrimaryExternalInfo = await getPrimaryExternalInfoByParty(ctx, partyId, includeArchivedParties);
    const pt = await findAndEnhancePrimaryTenant(partyDocument, otherPrimaryExternalInfo);

    const newExternalInfo = await insertExternalPartyMemberInfoForPrimaryMember(ctx, { party, primaryTenant: pt, propertyId: inventory?.property?.id });

    externalInfo = newExternalInfo;
  } else if (!externalInfo && party.leaseType === DALTypes.PartyTypes.TRADITIONAL) {
    externalInfo = await getPrimaryExternalInfoByParty(ctx, partyId, includeArchivedParties);
  }

  const primaryTenant = await findAndEnhancePrimaryTenant(partyDocument, externalInfo);

  return { party, primaryTenant, externalInfo };
};

export const getApplicationByPersonId = (partyDocument, personId) => {
  const applications = partyDocument.personApplications || [];
  return applications.find(a => a.partyId === partyDocument.id && a.personId === personId);
};

export const getInvoiceByApplicationId = (partyDocument, personApplicationId) => {
  const invoices = partyDocument.invoices || [];
  return invoices.find(i => i.paymentCompleted && i.personApplicationId === personApplicationId);
};

export const truncateField = (field, length) => field && field.toString().substr(0, length);

export const getExportName = (partyMember, companyName, fieldLength) => {
  if (companyName) return truncateField(companyName, fieldLength);
  if (partyMember.fullName) return truncateField(partyMember.fullName, fieldLength);
  if (partyMember.contactInfo.defaultPhone) return truncateField(partyMember.contactInfo.defaultPhone, fieldLength);

  return truncateField(partyMember.contactInfo.defaultEmail, fieldLength);
};

export const traditionalPartyIsNotInAnExportableState = (state, leaseType) =>
  leaseType === DALTypes.PartyTypes.TRADITIONAL &&
  ![DALTypes.PartyStateType.PROSPECT, DALTypes.PartyStateType.LEAD, DALTypes.PartyStateType.CONTACT, DALTypes.PartyStateType.APPLICANT].includes(state);

export const exportFilesForCorporate = async (ctx, partyDocument, data, exportEvent, otherData) => {
  if (data?.party?.leaseType !== DALTypes.PartyTypes.CORPORATE) return;

  const { externalInfo, releasedOnExecutedLease, partyData, lease } = otherData;

  logger.info(
    { ctx, partyId: data.party.id, externalInfo, exportEvent, releasedOnExecutedLease },
    'Yardi Export - Exporting files for corporate, push main tCode start',
  );

  const exportTypes = [ExportType.ResTenants, ExportType.ResProspects];

  const inventoryOnHoldForCorporate = await getInventoryOnHold(ctx, partyDocument, true);
  const { inventory } = await getInventoryToExport(
    ctx,
    partyDocument,
    { partyData: { ...partyData, inventoryOnHold: inventoryOnHoldForCorporate }, lease },
    true,
  );
  logger.info(
    { ctx, partyId: data.party.id, externalInfo, exportEvent, releasedOnExecutedLease, inventory: inventory?.name },
    'Yardi Export - Exporting files for corporate, inventory to export',
  );

  const propertyToExport = externalInfo?.propertyId && (await getPropertyById(ctx, externalInfo.propertyId));

  const dataToExport = {
    ...data,
    externalInfo,
    inventory: [data.property?.id, data.propertyToExport?.id].includes(inventory?.propertyId) ? inventory : null,
    lease: null,
    leaseTerm: null,
    propertyToExport,
  };

  const exportLogs = await exportData(ctx, exportTypes, dataToExport);

  logger.info(
    { ctx, exportEvent, exportLogIds: exportLogs?.map(exportLog => exportLog.id) },
    'Yardi Export - Exporting files for corporate, push main tCode - success',
  );
};
