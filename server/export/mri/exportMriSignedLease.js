/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import pick from 'lodash/pick';
import flattenDeep from 'lodash/flattenDeep';

import { DALTypes } from '../../../common/enums/DALTypes';

import { ExportType } from './export';
import { getExternalIdsForUser } from '../../services/users';
import { getInventoryExpanded } from '../../services/inventories';
import { getAdditionalInfoByPartyAndType } from '../../services/party';
import { getAllExternalInfoByPartyForMRI } from '../../dal/exportRepo';
import { shouldExportExternalUniqueId } from '../helpers';

import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { getPartyData, getCompanyName, isPartyInApplicantState, getAppointmentInventory, allPartyMembersSigned } from '../common-export-utils';
import { getExternalInfo, generateGuestCardsExportSteps, generateCoOccupantsExportSteps, processExportMessage } from './mri-export-utils';
import { getFeesToExport, getAllConcessions, getAllAvailableCharges } from './mriCharges';
import { isCorporateParty } from '../../../common/helpers/party-utils';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export/mri' });

const getAppFeeAmountFromInvoices = async (ctx, partyDocument, propertyId) => {
  const { personApplications, invoices = [] } = partyDocument;
  if (!personApplications || !personApplications.length || !invoices || !invoices.length) {
    return 0;
  }

  const invoicesForProperty = invoices.filter(inv => inv.propertyId === propertyId && inv.paymentCompleted);
  const sortedInvoices = orderBy(invoicesForProperty, 'created_at', 'desc');
  const externalPartyInfo = await getAllExternalInfoByPartyForMRI(ctx, partyDocument.id, propertyId);

  const invoicesToExport = sortedInvoices.filter(invoice => {
    const exportedInvoices = externalPartyInfo.map(partyMemberInfo => {
      const { exportData = {} } = partyMemberInfo.metadata;
      const { payments } = exportData;
      return payments && payments.map(payment => payment && payment.invoiceId);
    });

    return !flattenDeep(exportedInvoices).includes(invoice.id);
  });

  const amounts = personApplications
    .filter(app => !app.isFeeWaived)
    .map(app => {
      const invoice = invoicesToExport.find(inv => inv.personApplicationId === app.id);
      return invoice ? invoice.applicationFeeAmount - Number(invoice.applicationFeeWaiverAmount) : 0;
    });

  return amounts.reduce((total, amount) => total + amount, 0);
};

const getAppFeeAmount = async (ctx, partyDocument, externalInfo, propertyId) => {
  const { exportData = {} } = externalInfo.metadata;
  const { payments } = exportData;
  if (!payments) return await getAppFeeAmountFromInvoices(ctx, partyDocument, propertyId);

  return payments.reduce((total, payment) => {
    const current = payment.applicationFeeAmount - Number(payment.applicationFeeWaiverAmount);
    return total + current;
  }, 0);
};

const getSecurityDepositChargeAmount = fees => {
  const securityDeposit = fees.find(fee => ['unitdeposit', 'unitdepositstandard', 'unitdeposittownhome'].includes(fee.feeName.toLowerCase()));
  return securityDeposit ? Number(securityDeposit.amount).toFixed(2) : 0;
};

export const getData = async (ctx, partyDocument, partyId, leaseId) => {
  const partyData = await getPartyData(ctx, partyDocument);
  const { primaryTenant, externalInfo, party } = await getExternalInfo(ctx, partyDocument, leaseId);

  const appFeeAmount = await getAppFeeAmount(ctx, partyDocument, externalInfo, partyData.property.id);

  const corporateLeaseId = isCorporateParty(partyDocument) ? leaseId : null;
  const externals = await getAllExternalInfoByPartyForMRI(ctx, partyDocument.id, partyDocument.assignedPropertyId, corporateLeaseId);
  const companyName = getCompanyName(partyDocument, primaryTenant.id);
  const externalIds = await getExternalIdsForUser(ctx, partyDocument.ownerTeam, partyDocument.userId);

  const lease = (partyDocument.leases || []).find(l => l.id === leaseId);
  const quote = (partyDocument.quotes || []).find(q => q.id === lease.quoteId && q.publishedQuoteData);

  const leaseTermLength = lease && lease.baselineData.publishedLease.termLength;

  const inventory = await getInventoryExpanded(ctx, quote.inventoryId);
  const firstAppointmentInventory = partyDocument?.metadata?.appointmentInventory;

  const pets = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.PET);
  const vehicles = await getAdditionalInfoByPartyAndType(ctx, partyId, AdditionalInfoTypes.VEHICLE);

  const concessions = await getAllConcessions(ctx, lease);
  const feesToExport = await getFeesToExport(ctx, lease, concessions);
  const allAvailableCharges = await getAllAvailableCharges(ctx, lease, feesToExport);
  const securityDepositCharge = getSecurityDepositChargeAmount(feesToExport);
  const shouldExportExternalUniqueIdForAgent = await shouldExportExternalUniqueId(ctx, partyDocument.ownerTeam, partyDocument.userId);
  const partyShouldBeExportedAsApplicant = isPartyInApplicantState(partyDocument.invoices);

  const { personApplications } = partyDocument;

  return {
    tenantId: ctx.tenantId,
    primaryTenant,
    party,
    ...partyData,
    companyName,
    userExternalUniqueId: externalIds.externalUniqueId,
    teamMemberExternalId: externalIds.externalId,
    lease: {
      ...pick(lease, ['id', 'quoteId', 'leaseTermId', 'externalLeaseId']),
      baselineData: {
        quote: pick(lease.baselineData.quote, ['timezone', 'moveInDate', 'unitRent']),
        publishedLease: pick(lease.baselineData.publishedLease, [
          'additionalCharges',
          'concessions',
          'leaseStartDate',
          'leaseEndDate',
          'unitRent',
          'moveInDate',
        ]),
      },
    },
    quote: {
      ...pick(quote, ['inventoryId']),
      publishedQuoteData: {
        leaseTerms: quote.publishedQuoteData.leaseTerms.map(lt => pick(lt, ['id', 'termLength'])),
      },
    },
    inventory: {
      ...pick(inventory, ['itemType', 'itemId', 'name', 'externalId']),
      building: pick(inventory.building, ['externalId']),
      property: pick(inventory.property, ['externalId']),
    },
    appointmentInventory: await getAppointmentInventory(ctx, firstAppointmentInventory, partyData),
    workflowName: partyDocument.workflowName,
    pets,
    vehicles,
    leaseTermLength,
    feesToExport,
    allAvailableCharges,
    appFeeAmount,
    securityDepositCharge,
    shouldExportExternalUniqueIdForAgent,
    concessions,
    externalInfo,
    externals,
    personApplications,
    partyShouldBeExportedAsApplicant,
  };
};

export const exportMriSignedLease = async (ctx, partyDocument, exportEvent, extraPayload) => {
  try {
    const partyId = partyDocument.id;
    const { leaseId } = exportEvent.metadata;

    if (!allPartyMembersSigned(partyDocument.members, partyDocument.leases, leaseId)) {
      logger.info({ ctx, partyId: partyDocument.id }, 'Export MRI - skipping export. Not all party members signed');
      return;
    }

    logger.info({ ctx, partyId, exportEvent }, 'Export MRI - starting export on signed lease');

    const data = await getData(ctx, partyDocument, partyId, leaseId);

    const newLeaseExportSteps = async () => {
      const guestCardSteps = await generateGuestCardsExportSteps(ctx, partyDocument, data, true);
      return [
        ...guestCardSteps,
        ExportType.PetInformation,
        ExportType.VehicleInformation,
        ExportType.ClearSelectedUnit,
        ExportType.SelectUnit,
        ExportType.RentDetails,
        ExportType.RentableItemsAndFees,
        ExportType.AcceptLease,
        ExportType.ConfirmLease,
        ExportType.AssignItems,
      ].map((value, index) => ({ index, ...value }));
    };

    const renewalLeaseExportSteps = async () => {
      const coResidentsSteps = await generateCoOccupantsExportSteps(ctx, partyDocument, data, true);
      return [...coResidentsSteps, ExportType.VehicleInformation, ExportType.PetInformation, ExportType.RenewalOffer, ExportType.AcceptRenewalOffer].map(
        (value, index) => ({
          index,
          ...value,
        }),
      );
    };

    const exportSteps = partyDocument.workflowName === DALTypes.WorkflowName.RENEWAL ? await renewalLeaseExportSteps() : await newLeaseExportSteps();

    await processExportMessage(ctx, {
      partyId,
      data,
      exportSteps,
      extraPayload,
      mriExportAction: DALTypes.MriExportAction.SIGN_LEASE,
    });
  } catch (error) {
    logger.error({ ctx, error, partyId: partyDocument.id }, 'Export MRI - on signed lease - error');
    throw error;
  }
};
