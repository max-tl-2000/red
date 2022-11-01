/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import config from '../config';
import { addTokenToUrls } from './urlShortener';
import { resolveSubdomainURL } from '../../common/helpers/resolve-url';
import { getPersonById } from '../dal/personRepo';
import { getQuoteById, getQuoteByIdAndHoldInventory } from '../dal/quoteRepo';
import { getLeaseTermById } from '../dal/leaseTermRepo';
import { getTenant } from '../services/tenantService';
import { getApplicationSummaryForParty } from '../../rentapp/server/screening/utils';
import { getScreeningVersion } from '../../rentapp/server/helpers/screening-helper';
import { getUnitShortHand } from '../../common/helpers/quotes';
import { getAvailabilityDate, isAvailableNow } from '../../common/helpers/inventory';
import { now } from '../../common/helpers/moment-utils';

const throwErrorFor = missingField => {
  throw new Error(`Cannot get applyNow URL without a ${missingField}`);
};

const checkPrerequisitesForApplyNowUrl = ({ quoteId, personId, partyId, tenantDomain }) => {
  if (!quoteId) throwErrorFor('quoteId');
  if (!personId) throwErrorFor('personId');
  if (!partyId) throwErrorFor('partyId');
  if (!tenantDomain) throwErrorFor('tenantDomain');
};

export const getApplyNowUrlForPerson = async (ctx, { quoteId, personId, partyId, personName, propertyId, screeningVersion }) => {
  const { tenantId } = ctx;
  let tenantDomain = ctx.tenantDomain;

  if (tenantId && !tenantDomain) {
    const tenant = await getTenant({ tenantId });
    if (!tenant) throwErrorFor('tenantDomain or valid tenantId');
    // TODO: move this into a helper ?
    tenantDomain = `${tenant.name}.${config.domainSuffix}`;
  }
  checkPrerequisitesForApplyNowUrl({
    quoteId,
    personId,
    partyId,
    tenantDomain,
  });
  const rentappHostname = config.rentapp.hostname;
  // TODO protocol must be changed to use the ctx.authUser.protocol. However, ctx.authUser.protocol is getting 'http' even the site has https.
  const baseUrl = resolveSubdomainURL(`https://${tenantDomain}/applyNow/`, rentappHostname);
  // TODO This is creating a Token for one person; it should return separate urls for each partyMember
  const info = {
    quoteId,
    tenantId,
    personId,
    partyId,
    personName,
    tenantDomain,
    propertyId,
    screeningVersion,
  };
  return addTokenToUrls(baseUrl, info, false, {
    expiresIn: config.rentapp.tokenExpiration,
  });
};

export const getApplyNowUrlForPublishedQuote = async (ctx, { id: quoteId, partyMembers, propertyId }) => {
  const { tenantId, hostname: tenantDomain } = ctx;
  if (!partyMembers?.length || !partyMembers[0]) {
    throw Error(`At least one party member is expected, instead got ${partyMembers?.length}`);
  }
  const { preferredName, fullName, id: personId } = await getPersonById(ctx, partyMembers[0].personId);

  const { partyId } = partyMembers[0];
  const personName = preferredName || fullName || '';

  const screeningVersion = await getScreeningVersion({ tenantId, partyId });

  return await getApplyNowUrlForPerson({ ...ctx, tenantDomain }, { personId, partyId, quoteId, personName, propertyId, screeningVersion });
};

export const getUnitNameIfIsHoldByParty = async ({ tenantId, quoteId }) => {
  const quote = await getQuoteByIdAndHoldInventory({ tenantId }, quoteId);
  return getUnitShortHand(quote.inventory);
};

export const getUnitQuoteName = async ({ tenantId, quoteId }) => {
  const quote = await getQuoteById({ tenantId }, quoteId);
  return getUnitShortHand(quote.inventory);
};

export const getQuotePromotionLogEntry = async (ctx, promotedQuote, conditions = {}) => {
  const { quoteId, partyId, leaseTermId } = promotedQuote;
  const { additionalNotes } = conditions;

  const tenantId = ctx.tenantId;
  const applicationSummary = await getApplicationSummaryForParty(ctx, partyId);
  const { period, termLength } = await getLeaseTermById(ctx, leaseTermId);

  const leaseTerm = `${termLength} ${t(period.toUpperCase() + (termLength !== 1 && 'S'))}`;
  return {
    partyId,
    id: quoteId,
    unitShortHand: await getUnitQuoteName({ tenantId, quoteId }),
    leaseTerm,
    notes: additionalNotes,
    ...(applicationSummary ? { applicationStatus: applicationSummary.applicationStatus } : {}),
    ...(applicationSummary ? { screeningStatus: applicationSummary.screeningStatus } : {}),
  };
};

export const getInventoryGroupIdsFromQuotes = quotes =>
  quotes.reduce((acc, { publishDate, inventory }) => {
    const { inventoryGroupId } = inventory;
    if (publishDate || acc.includes(inventoryGroupId)) return acc;

    acc.push(inventoryGroupId);
    return acc;
  }, []);

export const getInventoryIdsFromQuotes = quotes =>
  quotes.reduce((acc, { inventory }) => {
    const inventoryId = inventory.id;
    if (acc.includes(inventoryId)) return acc;

    acc.push(inventoryId);
    return acc;
  }, []);

export const computeLeaseStartDateForQuote = (moveInDateTime, { propertySettings, inventory }) => {
  const { marketing, timezone } = propertySettings || {};
  const { selfServeMaxLeaseStartDate } = marketing || {};
  if (!selfServeMaxLeaseStartDate || (!inventory.availabilityDate && !inventory.priceAvailabilityDate)) {
    return moveInDateTime;
  }

  const availabilityStartDate = isAvailableNow(inventory, timezone) ? now({ timezone }) : getAvailabilityDate(inventory, timezone);
  const availabilityEndDate = availabilityStartDate.clone().add(parseInt(selfServeMaxLeaseStartDate, 10), 'days');

  const moveInDateIsBetweenAvailabilityDates = moveInDateTime.isBetween(availabilityStartDate, availabilityEndDate, null, '[)');
  if (moveInDateIsBetweenAvailabilityDates) {
    return moveInDateTime;
  }

  /* When the move in date(user input) is not available for renting, we get the closest one to this date, for example:
   * MoveInDate: 2020/02/02              // User input
   * AvailabilityStartDate: 2020/03/02   // When the unit will be available
   * AvailabilityEndDate: 2020/12/02     // When the unit will become unavailable
   * Result = 2020/03/02
   */
  const isAvailabilityStartDateTheClosest =
    Math.abs(moveInDateTime.diff(availabilityStartDate, 'days')) <= Math.abs(moveInDateTime.diff(availabilityEndDate, 'days'));

  return isAvailabilityStartDateTheClosest ? availabilityStartDate : availabilityEndDate;
};
