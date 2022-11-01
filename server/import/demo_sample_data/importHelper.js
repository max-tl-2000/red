/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { getPropertyByName } from '../../dal/propertyRepo';
import { saveQuote } from '../../dal/quoteRepo';
import { getPartyLeases } from '../../dal/leaseRepo';
import { getInventoriesByPropertyId } from '../../dal/inventoryRepo';
import { getLeaseTermsByInventoryId } from '../../dal/leaseTermRepo';
import { updateQuoteById } from '../../services/quotes';
import { signLease } from '../../services/leases/leaseService';
import { getHostnameFromTenantId } from '../../services/leases/urls';
import { getConcessionsByFilters } from '../../services/concessions';
import { publishLease } from '../../api/actions/leases';
import { insertQuotePromotion } from '../../api/actions/party';
import { DALTypes } from '../../../common/enums/DALTypes';
import { LA_TIMEZONE } from '../../../common/date-constants';
import { now } from '../../../common/helpers/moment-utils';
import sleep from '../../../common/helpers/sleep';

export const createAndPublishQuote = async (ctx, data) => {
  const { partyId, propertyName, unitName, rentAmount = 1000, leaseState = DALTypes.LeaseState.NEW, leaseLength } = data;
  const property = await getPropertyByName(ctx, propertyName);
  if (!property) {
    throw new Error(`Could not find property for name ${propertyName}`);
  }
  const inventories = await getInventoriesByPropertyId(ctx, property.id);
  const inventory = inventories.find(unit => unit.name === unitName);
  // TODO: remove the hardcoded propertyTimezone here
  const quote = await saveQuote(ctx, { inventoryId: inventory.id, partyId, propertyTimezone: LA_TIMEZONE, leaseState });

  const terms = await getLeaseTermsByInventoryId(ctx, inventory.id, quote.leaseState);

  const term = leaseLength ? terms.find(t => t.termLength === leaseLength) || terms[0] : terms[0];

  const leaseTerms = [
    {
      id: term.id,
      concessions: [],
      additionalAndOneTimeCharges: [],
    },
  ];
  const concessions = await getConcessionsByFilters(ctx, terms[0], inventory.id, quote);
  const selections = {
    selectedLeaseTerms: [
      {
        id: term.id,
        paymentSchedule: [
          {
            timeframe: now().add(10, 'days').toISOString(),
            amount: rentAmount, // this is just used for screening
          },
        ],
        concessions,
      },
    ],
    selectedAdditionalAndOneTimeCharges: {
      name: 'month',
      fees: [],
    },
  };

  // publish the quote
  const updatedQuote = await updateQuoteById(ctx, quote.id, {
    leaseTerms,
    selections,
    expirationDate: now({ timezone: property.timezone }).endOf('day').add(50, 'days').toISOString(),
    leaseStartDate: now({ timezone: property.timezone }).startOf('day').toISOString(),
    publishDate: now({ timezone: property.timezone }).toISOString(),
    propertyTimezone: property.timezone,
  });

  return {
    leaseTermId: term.id,
    concessions,
    ...updatedQuote,
  };
};

const promoteQuote = async (ctx, partyId, publishedQuote) => {
  await sleep(1000);
  return await insertQuotePromotion({
    tenantId: ctx.tenantId,
    params: {
      partyId,
    },
    body: {
      partyId,
      quoteId: publishedQuote.id,
      leaseTermId: publishedQuote.leaseTermId,
      promotionStatus: DALTypes.PromotionStatus.APPROVED,
    },
  });
};

export const createLeaseForParty = async (ctx, partyId, publishedQuote) => {
  await promoteQuote(ctx, partyId, publishedQuote);
  const [lease] = await getPartyLeases(ctx, partyId);
  return lease;
};

export const publishLeaseForParty = async (ctx, partyId, lease) => {
  const hostname = ctx.host || (await getHostnameFromTenantId(ctx, ctx.tenantId));

  return await publishLease({
    tenantId: ctx.tenantId,
    protocol: ctx.protocol,
    hostname,
    params: {
      partyId,
      leaseId: lease.id,
    },
    body: lease,
  });
};

export const signLeaseByAllPartyMembers = async (ctx, leaseId, partyId) => {
  await sleep(1000);
  const partyLease = (await getPartyLeases(ctx, partyId)).find(l => l.id === leaseId);
  const membersSignatures = partyLease.signatures && partyLease.signatures.filter(item => item.partyMemberId);

  await mapSeries(
    membersSignatures,
    async signature =>
      await signLease({
        ctx,
        envelopeId: signature.envelopeId,
        clientUserId: signature.metadata.clientUserId,
      }),
  );

  return partyLease;
};

export const counterSignLease = async (ctx, leaseId, partyId) => {
  await sleep(500);
  const partyLease = (await getPartyLeases(ctx, partyId)).find(l => l.id === leaseId);
  const countersignerSignature = partyLease.signatures.filter(item => item.userId);

  await mapSeries(countersignerSignature, async signature => {
    await signLease({
      ctx,
      envelopeId: signature.envelopeId,
      clientUserId: signature.metadata.clientUserId,
    });
  });
  return partyLease;
};
