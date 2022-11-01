/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import marked from 'marked';
import { VIEW_MODEL_TYPES } from './enums';
import { getQuoteByIdQuery, isRenewalQuoteOrCorporateLease } from '../../dal/quoteRepo';
import { formatUnitAddress } from '../../../common/helpers/addressUtils';
import { filterLeaseTermsSelectedConcessions } from '../concessions';
import { formatPropertyAssetUrl } from '../../helpers/assets-helper';
import { getBigLayoutImage, getImageForEmail } from '../../../common/helpers/cloudinary';
import { addTokenToUrls } from '../../helpers/urlShortener';
import { getDisplayName as getPersonDisplayName } from '../../../common/helpers/person-helper';
import { getPublishedQuoteDataWithMonthlyTotalCharges, getRentableItemsForRenewalLease } from '../quotes';
import { inventoryStateRepresentation } from '../../../common/inventory-helper';
import { MONTH_DATE_YEAR_LONG_FORMAT } from '../../../common/date-constants';
import { toMoment, formatMoment } from '../../../common/helpers/moment-utils';
import { getApplyNowUrlForPublishedQuote } from '../../helpers/quotes';
import { flattenedPaymentSchedule, filterOutLeaseTermsBakedConcessions, flattenedLeaseTermsInfo } from '../../../common/helpers/quotes';
import { getPolicyStatement, getHighValueAmenityNames, getQuoteLayoutSummary } from '../../../client/helpers/inventory';
import { getPartyMemberByPartyIdAndPersonId } from '../../dal/partyRepo';
import { sendUrltoShortener } from '../urlShortener';
import { formatMoney, Currency } from '../../../common/money-formatter';
import envVal from '../../../common/helpers/env-val';

import config from '../../config';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const getContextQuery = (ctx, { quoteId }) => getQuoteByIdQuery(ctx, quoteId).toString();

export const prerequisites = quote => {
  const { inventory, selections, publishedQuoteData } = quote;
  const highValueAmenities = getHighValueAmenityNames(inventory, true);
  const otherAmenities = getHighValueAmenityNames(inventory, false);
  const { property } = inventory;
  publishedQuoteData.leaseTerms = filterLeaseTermsSelectedConcessions(publishedQuoteData.leaseTerms, selections.selectedLeaseTerms);
  const finalPublishedQuoteData = getPublishedQuoteDataWithMonthlyTotalCharges(publishedQuoteData);
  const { createQuoteFromRaw } = require('../../../client/helpers/models/quote'); // eslint-disable-line global-require
  const quoteModel = createQuoteFromRaw(finalPublishedQuoteData);
  const { leaseTerms } = quoteModel;
  const filteredLeaseTerms = filterOutLeaseTermsBakedConcessions(leaseTerms);

  return { ...quote, quoteModel, highValueAmenities, otherAmenities, property, filteredLeaseTerms };
};

export const tokensMapping = {
  personId: (quote, extraData) => extraData.personId,
  confirmationId: ({ quoteModel }) => quoteModel.confirmationNumber,
  policyStatement: ({ inventory }) => marked(getPolicyStatement(inventory), { gfm: true }),
  renewalPolicyStatement: ({ property: { settings } }) => settings.quote.renewalLetterPolicyStatement,
  applyNowUrl: async (quote, extraData) => {
    const { ctx, personId } = extraData;
    if (!personId) return '';

    const {
      id,
      partyId,
      inventory: { property },
    } = quote;
    const partyMember = await getPartyMemberByPartyIdAndPersonId(ctx, partyId, personId);
    const context = { ...ctx, hostname: ctx.hostname || ctx.host };
    return await getApplyNowUrlForPublishedQuote(context, { id, partyMembers: [partyMember], propertyId: property.id });
  },
  leaseStartDate: ({ quoteModel, property: { timezone } }) => toMoment(quoteModel.leaseStartDate, { timezone }).format(MONTH_DATE_YEAR_LONG_FORMAT),
  expirationDate: ({ quoteModel, property: { timezone } }) => formatMoment(quoteModel.expirationDate, { format: MONTH_DATE_YEAR_LONG_FORMAT, timezone }),
  renewalExpiryDate: ({ publishDate, leaseStartDate, property: { timezone, settings } }) => {
    const computedExpiryDate = toMoment(publishDate, { timezone }).add(parseInt(settings.quote.renewalLetterExpirationPeriod, 10), 'days');
    const leaseStartDateTime = toMoment(leaseStartDate, { timezone });

    return (computedExpiryDate.isBefore(leaseStartDateTime) ? computedExpiryDate : leaseStartDateTime).format(MONTH_DATE_YEAR_LONG_FORMAT);
  },
  'flattenedInventory.propertyName': ({ property: { displayName = '' } }) => displayName,
  flattenedInventory: async ({ property, inventory, highValueAmenities, otherAmenities }, extraData) => {
    const { timezone, displayName } = property;
    const { complimentaryItems } = inventory;

    const { ctx, tokenParams } = extraData;
    const propertyAssetUrl = await formatPropertyAssetUrl(ctx, property.id, { permaLink: true, from: 'template' });

    return {
      propertyName: displayName,
      timezone,
      address: formatUnitAddress(inventory),
      layoutInf: getQuoteLayoutSummary(inventory),
      imageUrl: tokenParams.length ? getImageForEmail(propertyAssetUrl, tokenParams) : getBigLayoutImage(propertyAssetUrl),
      status: inventoryStateRepresentation(inventory),
      highValueAmenities,
      otherAmenities,
      complimentaryItems: {
        title: t('QUOTE_DRAFT_INCLUDES_COMPLIMENTARY'),
        items: complimentaryItems || [],
      },
    };
  },
  flattenedLeaseTerms: ({ filteredLeaseTerms }) => flattenedLeaseTermsInfo(filteredLeaseTerms),
  paymentSchedule: ({ quoteModel, highValueAmenities, otherAmenities, filteredLeaseTerms }) => {
    const { leaseStartDate, additionalAndOneTimeCharges } = quoteModel;
    return flattenedPaymentSchedule(filteredLeaseTerms, leaseStartDate, highValueAmenities, otherAmenities, additionalAndOneTimeCharges);
  },
  hideApplicationLink: async ({ id: quoteId }, { ctx }) => await isRenewalQuoteOrCorporateLease(ctx, quoteId),
  'inventory.type': ({ inventory: { type = '' } }) => type,
  'inventory.displayName': ({ inventory: { name = '' } }) => name,
  webUrl: async (quote, { ctx, quoteId, person, isPreview }) => {
    if (isPreview) return '[Quote Link]';
    if (!person) return null;

    const { sender, authUser, tenantId, tenantName } = ctx;

    const { domain = `${tenantName}.${envVal('DOMAIN', 'local.env.reva.tech')}` } = sender || authUser;

    const longUrl = `https://${domain}/publishedQuote/${quoteId}`;
    const urlWithToken = addTokenToUrls(
      longUrl,
      { quoteId, personId: person.id, personName: getPersonDisplayName(person, { usePreferred: true, ignoreContactInfo: true }), tenantId },
      true,
      { expiresIn: config.quote.tokenExpiration },
    );

    const [shortenedUrl] = await sendUrltoShortener(ctx, [urlWithToken]);

    return shortenedUrl;
  },
  renewalLeaseFees: async (_, { ctx, quoteId }) => {
    if (!quoteId) return [];

    return (await getRentableItemsForRenewalLease(ctx, quoteId)).map(({ amount, ...rest }) => {
      const { result: amountFormatted } = formatMoney({ amount, currency: Currency.USD.code });
      return {
        ...rest,
        amount: amountFormatted,
      };
    });
  },
};
