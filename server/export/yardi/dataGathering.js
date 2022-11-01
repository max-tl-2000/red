/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sortBy from 'lodash/sortBy';

import { sortByCreationDate } from '../../../common/helpers/sortBy';
import { toMoment } from '../../../common/helpers/moment-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getInventoryExpanded } from '../../services/inventories';
import { ProspectStatus } from './mappers/resProspects';
import { TenantStatus } from './mappers/resTenants';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'export' });

export const getComms = async (ctx, partyDocument, primaryTenant) => {
  logger.trace({ ctx, partyId: partyDocument.id, primaryTenant }, 'getComms');

  const primaryTenantComms = (partyDocument.comms || []).filter(comm => comm.persons.includes(primaryTenant.personId));
  const [firstTour] = (partyDocument.tasks || []).filter(
    t => t.category === DALTypes.TaskCategories.APPOINTMENT && t.state === DALTypes.TaskStates.COMPLETED && t.metadata.partyMembers.includes(primaryTenant.id),
  );

  return {
    primaryTenantComms,
    firstShowDate: firstTour && firstTour.dueDate,
  };
};

export const getExecutedLease = party => (party.leases || []).find(lease => lease.partyId === party.id && lease.status === DALTypes.LeaseStatus.EXECUTED);

export const getQuoteForLease = (partyDocument, lease) => {
  if (!lease) return null;
  return (partyDocument.quotes || []).find(quote => quote.id === lease.quoteId);
};

export const getLeaseTerm = (lease, quote) => {
  const leaseTermFromLease = lease && lease.baselineData.publishedLease.termLength;

  if (leaseTermFromLease) {
    return {
      termLength: leaseTermFromLease,
    };
  }

  return (quote && quote.publishedQuoteData.leaseTerms.find(lt => lt.id === lease.leaseTermId)) || 0;
};

// For corporate parties wher there could be several promotions we will return the same promotion/inventory
const getPromotionFromPartyDocument = partyDocument => {
  const [quotePromotion] = partyDocument.promotions
    ? sortBy(
        partyDocument.promotions.filter(p => p.promotionStatus === DALTypes.PromotionStatus.APPROVED),
        promotion => -toMoment(promotion.created_at),
      )
    : '';
  return quotePromotion;
};

const getPromotionFromLease = (partyDocument, lease) => {
  const quoteId = lease.quoteId;
  const [quotePromotion] = partyDocument.promotions
    ? sortBy(
        partyDocument.promotions.filter(p => p.quoteId === quoteId && p.promotionStatus === DALTypes.PromotionStatus.APPROVED),
        promotion => -toMoment(promotion.created_at),
      )
    : '';
  return quotePromotion;
};

const getInventoryFromQuotePromotion = async (ctx, partyDocument) => {
  const promotion = getPromotionFromPartyDocument(partyDocument);
  const quote = promotion && partyDocument.quotes?.find(q => q.id === promotion.quoteId);

  const inventory = quote ? await getInventoryExpanded(ctx, quote?.inventoryId) : null;
  return { promotion, inventory };
};

const getQuoteFromInvoice = (ctx, partyDocument, invoice) => {
  logger.trace({ ctx, partyId: partyDocument.id, invoice }, 'getQuoteAndInventoryFromInvoice');

  const quoteId = invoice?.quoteId;
  if (!quoteId || !invoice?.paymentCompleted) return {};

  const quote = partyDocument.quotes.find(x => x.id === quoteId);
  return {
    quote,
    invoiceCreatedAt: invoice?.created_at,
  };
};

const getInventoryFromInvoices = async (ctx, partyDocument) => {
  if (!partyDocument.invoices) return null;
  const dataFromInvoices = partyDocument.invoices.map(inv => getQuoteFromInvoice(ctx, partyDocument, inv));

  const filteredDataFromInvoices = dataFromInvoices?.filter(di => di.quote).sort((a, b) => sortByCreationDate(a, b, { field: 'invoiceCreatedAt' }));

  if (!filteredDataFromInvoices?.length) return null;

  return await getInventoryExpanded(ctx, filteredDataFromInvoices[0]?.quote?.inventoryId);
};

const getInventoryFromFirstCompletedAppointment = async (ctx, partyDocument) => {
  const appointmentInventory = partyDocument?.metadata?.appointmentInventory;
  if (!appointmentInventory?.inventoryId) return null;

  logger.trace(
    { ctx, partyId: partyDocument.id, appointmentInventory },
    'getInventoryFromFirsCompletedAppointment - Inventory from first completed appointment',
  );

  return await getInventoryExpanded(ctx, appointmentInventory.inventoryId);
};

export const getInventoryToExport = async (ctx, partyDocument, data, skipLeaseAndPromotion = false) => {
  logger.trace({ ctx, partyId: partyDocument.id, skipLeaseAndPromotion }, 'getInventoryToExport - yardi export');
  const { partyData, lease } = data;

  // If a lease is known, use the lease info for the unit (this covers the case of corporate parties)
  if (lease?.baselineData?.quote?.inventoryId && !skipLeaseAndPromotion) {
    const leaseInventory = await getInventoryExpanded(ctx, lease.baselineData.quote.inventoryId);
    const leasePromotion = getPromotionFromLease(partyDocument, lease);
    logger.trace(
      { ctx, partyId: partyDocument.id, leaseId: lease.id, promotionId: leasePromotion.id, inventory: leaseInventory },
      'getInventoryToExport - Inventory from lease found',
    );

    return { quotePromotion: leasePromotion, inventory: leaseInventory };
  }

  // Use the inventory from the promoted quote if exists (if several rpesetn in corporate parties for ex, takes the lastest one)
  if (!skipLeaseAndPromotion) {
    const { promotion, inventory } = await getInventoryFromQuotePromotion(ctx, partyDocument);
    if (inventory) {
      logger.trace({ ctx, partyId: partyDocument.id, promotionId: promotion.id, inventory }, 'getInventoryToExport - Inventory from quote promotion found');

      return { quotePromotion: promotion, inventory };
    }
  }

  // Use the inventory from the most recent held unit if at least one is being held for the current party
  if (partyData?.inventoryOnHold) {
    // In case we have a hold without application, to activate the hold in yardi we have to say that the tenant is an applicant,
    // so we indicate that we want the following state at a minimum in the file if a unit is held in Reva.
    partyData.minProspectStatus = ProspectStatus.Applied;
    partyData.minTenantStatus = TenantStatus.Applicant;

    logger.trace(
      {
        ctx,
        partyId: partyDocument.id,
        inventory: partyData.inventoryOnHold,
        minProspectStatus: partyData.minProspectStatus,
        minTenantStatus: partyData.minTenantStatus,
      },
      'getInventoryToExport - Inventory on hold found',
    );

    return { inventory: partyData.inventoryOnHold };
  }

  // Use the inventory from the latest application payment that is associated with a quote
  const inventoryFromInvoices = await getInventoryFromInvoices(ctx, partyDocument);
  if (inventoryFromInvoices) {
    logger.trace({ ctx, partyId: partyDocument.id, inventory: inventoryFromInvoices }, 'getInventoryToExport - Inventory from invoices found');

    return { inventory: inventoryFromInvoices };
  }

  // Use the first inventory from the first completed tour
  const inventoryFromFirstCompletedAppointment = await getInventoryFromFirstCompletedAppointment(ctx, partyDocument);
  if (inventoryFromFirstCompletedAppointment) {
    logger.trace(
      { ctx, partyId: partyDocument.id, inventory: inventoryFromFirstCompletedAppointment },
      'getInventoryToExport - Inventory from first completed appointment',
    );
    return { inventory: inventoryFromFirstCompletedAppointment };
  }

  // Otherwise... no inventory to export
  logger.trace({ ctx, partyId: partyDocument.id }, 'getInventoryToExport - No inventory found - defaulting to RevaApp');
  return {};
};
