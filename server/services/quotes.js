/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { difference, omit, pick, reduce, isEqual } from 'lodash'; // eslint-disable-line red/no-lodash
import orderBy from 'lodash/orderBy';
import Promise from 'bluebird';
import { ServiceError } from '../common/errors';
import { getOne, runInTransaction } from '../database/factory';

import logger from '../../common/helpers/logger';
import {
  getConcessionValue,
  getRecurringAndOneTimeChargesObject,
  getTermLengths,
  getUnitShortHand,
  updateTermWithMatrixRents,
  updateLeaseTermsWithMatrixRents,
  getLeaseTermsWithoutRent,
  isAValidLeaseStartDateInRentMatrix,
  extractFeeId,
} from '../../common/helpers/quotes';
import * as dal from '../dal/quoteRepo';
import { getAppSettingValue } from '../dal/appSettingsRepo';
import { getInventoriesOnHoldForParty, getPropertyTimezoneFromInventoryId, getInventoryById } from '../dal/inventoryRepo';
import { getLeaseTermsForQuote, filterSelectedLeaseTerms, getLeaseTermsForQuoteList } from './leaseTerms';
import { mapSelectedLeaseTermsAndConcessions } from './concessions';
import { getAdditionalOneTimeFeesByPeriod } from './fees';
import { logEntityAdded, logEntity, logEntityRemoved } from './activityLogService';
import { COMPONENT_TYPES, ACTIVITY_TYPES, SUB_COMPONENT_TYPES } from '../../common/enums/activityLogTypes';
import { getPartyMembersByQuoteId, loadPartyById, updateParty, getPartyWorkflowByPartyId } from '../dal/partyRepo';
import { getApplyNowUrlForPublishedQuote, getInventoryGroupIdsFromQuotes, getInventoryIdsFromQuotes } from '../helpers/quotes';
import { APP_EXCHANGE, SCREENING_MESSAGE_TYPE } from '../helpers/message-constants';
import { getAndFormatAdditionalAndOneTimeChargesByperiod } from '../helpers/fees';
import { sendMessage } from './pubsub';
import { getTenant } from './tenantService';
import { validateActionOnInventory, getComplimentsForInventory } from './inventories';
import { ActionTypes } from '../../common/enums/actionTypes';
import { getInventoryLeasePartyMembers, getLastExecutedLeaseByInventoryId } from '../dal/leaseRepo';
import { isInventoryLeasedOnPartyType } from '../../common/helpers/inventory';
import { markUnitsAsFavorite } from './favoriteUnits';
import { LA_TIMEZONE } from '../../common/date-constants';
import { notify } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { loadUserById } from './users';
import { getSenderInfo } from '../helpers/mails';
import { saveQuotePublishedEvent, saveQuoteMailSentEvent, saveQuotePrintedEvent, saveQuoteCreatedEvent } from './partyEvent';
import { isCorporateParty as isACorporateParty, isScreeningRequired } from '../../common/helpers/party-utils';
import { getRMSPricingWithAdjustments, isInventoryPriceUnavailable, addAdjustmentsToRentMatrix } from './rms';
import { getPropertySettingsByIds } from '../dal/propertyRepo';
import { now, toMoment, isMoment } from '../../common/helpers/moment-utils';
import { DALTypes } from '../../common/enums/DALTypes';
import { inventoryStateFutureDate } from '../helpers/inventory';
import { sendQuoteEmailComm } from './mjmlEmails/quoteEmails';
import { shouldEnableQuoteAction } from '../../common/inventory-helper';
import { computeInventoryMarketRentByPartyWorkflow, getMarketRentInfoForUnit } from './helpers/marketRentHelpers';
import { getLeaseTermsByInventoryGroupIds } from '../dal/leaseTermRepo';
import { getRMSPricingByInventoryIds } from '../dal/rmsPricingRepo';
import { hasLeaseExpired } from './leases/leaseService';
import { getCommsTemplateByPropertyIdAndTemplateSetting } from './templates';
import { OtherExceptionReportRules } from '../helpers/exceptionReportRules';
import { createExceptionReport } from './importActiveLeases/process-data/exception-report';
import { setDefaultVariableAmount, updateFeeAmountToInventoryGroupFeeOrFeeAmount } from '../../common/helpers/fee';

const validateQuote = quote => {
  if (!quote?.id) {
    throw new ServiceError({ token: 'INVALID_QUOTE_ID', status: 404 });
  }
  return quote;
};

const getDefaultStartDateAndLeaseLength = rmsPricing => ({
  defaultLeaseStartDate: rmsPricing.minRentStartDate,
  defaultLeaseLengths: [rmsPricing.minRentLeaseLength],
});

const getLogSubComponent = leaseState => (leaseState === DALTypes.LeaseState.NEW ? null : SUB_COMPONENT_TYPES.RENEWAL_LETTER);

const notifyQuotesUpdated = async (ctx, partyId) => {
  const party = await loadPartyById(ctx, partyId);
  await notify({
    ctx,
    event: eventTypes.QUOTES_UPDATED,
    data: { partyId },
    routing: { teams: [party.ownerTeam, ...party.teams] },
  });
};

const getAllQuotes = ctx => dal.getQuotes(ctx);

const getInventoriesPropertyIds = quotes =>
  quotes.reduce((acc, { inventory }) => {
    const propertyId = inventory.property.id;

    if (!acc.includes(propertyId)) {
      acc.push(propertyId);
    }
    return acc;
  }, []);

export const getPublishedQuotesDataByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getPublishedQuotesDataByPartyId started!');
  const startTime = now();
  const results = await dal.loadPublishedQuotesDataByPartyId(ctx, partyId);
  const publishedQuotes = results.map(({ publishedQuoteData }) => publishedQuoteData);
  const endTime = now();
  logger.trace({ ctx, partyId, timeExpend: endTime - startTime }, 'getPublishedQuotesDataByPartyId finished!');
  return publishedQuotes;
};

const getQuotesListDataByPartyId = async (ctx, partyId) => {
  const quoteListData = { quotes: [] };
  const partyWorkflowGetter = async () => {
    const partyWorkflow = await getPartyWorkflowByPartyId(ctx, partyId);
    if (!partyWorkflow) {
      throw new ServiceError({ token: 'PARTY_NOT_FOUND', status: 404 });
    }
    quoteListData.partyWorkflow = partyWorkflow;
  };

  const quotesGetter = async () => {
    const quotes = await dal.loadQuotesByPartyId(ctx, partyId);
    quoteListData.quotes = quotes;
  };

  const inventoriesOnHoldGetter = async () => {
    const inventoriesOnHold = await getInventoriesOnHoldForParty(ctx, partyId);
    quoteListData.inventoriesOnHold = inventoriesOnHold;
  };

  await Promise.all([partyWorkflowGetter, quotesGetter, inventoriesOnHoldGetter].map(async func => await func()));

  const { quotes } = quoteListData;

  const propertiesSettingsGetter = async () => {
    const inventoriesPropertyIds = getInventoriesPropertyIds(quotes);
    const propertiesSettings = await getPropertySettingsByIds(ctx, inventoriesPropertyIds);
    quoteListData.propertiesSettings = propertiesSettings;
  };

  const leaseMembersGetter = async () => {
    // There can only be one leased inventory
    const leasedInventory = (quotes.find(({ inventory }) => isInventoryLeasedOnPartyType(inventory.state, { workflowName: quoteListData.partyWorkflow })) || {})
      .inventory;
    const executedLease = leasedInventory ? await getLastExecutedLeaseByInventoryId(ctx, leasedInventory.id, partyId) : null;

    const leaseMembers = leasedInventory ? await getInventoryLeasePartyMembers(ctx, leasedInventory.id) : [];
    quoteListData.leaseMembers = leaseMembers;
    quoteListData.leasedInventory = leasedInventory &&
      executedLease &&
      !hasLeaseExpired(executedLease, leasedInventory.property.timezone) && {
        ...leasedInventory,
        executedLease: { partyId: executedLease.partyId, agentName: executedLease.agentName },
      };
  };

  const leaseTermsGetter = async () => {
    const inventoryGroupIds = getInventoryGroupIdsFromQuotes(quotes);
    const leaseTerms = inventoryGroupIds.length ? await getLeaseTermsByInventoryGroupIds(ctx, inventoryGroupIds, true) : [];
    quoteListData.leaseTerms = leaseTerms;
  };

  const rmsPricingGetter = async () => {
    const inventoryIds = getInventoryIdsFromQuotes(quotes);
    const rmsPricing = inventoryIds.length ? await getRMSPricingByInventoryIds(ctx, inventoryIds) : [];
    quoteListData.rmsPricing = rmsPricing;
  };

  await Promise.all([propertiesSettingsGetter, leaseMembersGetter, leaseTermsGetter, rmsPricingGetter].map(async func => await func()));

  quoteListData.quotes = orderBy(quotes, ['publishDate', 'created_at'], ['desc', 'desc']);
  logger.trace({ ctx, partyId }, `Found ${quotes.length} quotes`);

  return quoteListData;
};

const getAllQuotesByPartyId = async (ctx, partyId) => {
  logger.trace({ ctx, partyId, readOnlyServer: ctx.readOnlyServer }, 'getAllQuotesByPartyId');

  const startTime = now();
  const {
    partyWorkflow,
    quotes,
    inventoriesOnHold,
    propertiesSettings,
    leasedInventory,
    leaseMembers,
    leaseTerms,
    rmsPricing,
  } = await getQuotesListDataByPartyId(ctx, partyId);

  const partyQuotes = quotes.map(quote => {
    const { publishDate, inventory, publishedQuoteData, leaseState, selections: quoteSelections } = quote;
    const { id: inventoryId, inventoryGroupId, property } = inventory;

    const filteredLeaseTerms = publishDate
      ? publishedQuoteData.leaseTerms
      : getLeaseTermsForQuoteList(ctx, { leaseTerms, rmsPricing, inventoryId, inventoryGroupId, leaseState, quoteSelections });

    const inventoryHolds = inventoriesOnHold.filter(inventoryOnHold => inventoryOnHold.inventoryId === inventoryId);

    const propertySettings = propertiesSettings.find(ps => ps.id === property.id);
    const { marketRent } = computeInventoryMarketRentByPartyWorkflow({ propertySettings, partyWorkflow, inventoryObject: inventory });

    const propertyTimezone = (property || {}).timezone;
    const nextStateExpectedDate = inventoryStateFutureDate({
      ...inventory,
      propertyTimezone,
    });

    const leasePartyMembers = leasedInventory?.id === inventoryId ? leaseMembers : [];
    const executedLease = leasedInventory?.id === inventoryId ? leasedInventory.executedLease : {};

    const { rentMatrix } = rmsPricing.find(pricing => pricing.inventoryId === inventoryId && pricing.pricingType === leaseState) || {};
    const adjustedRentMatrix = rentMatrix ? addAdjustmentsToRentMatrix(ctx, filteredLeaseTerms, quoteSelections, rentMatrix, inventoryId) : {};

    return {
      ...quote,
      propertyTimezone,
      leaseTerms: filteredLeaseTerms,
      rentMatrix: adjustedRentMatrix,
      inventory: {
        ...inventory,
        nextStateExpectedDate,
        leasePartyMembers,
        marketRent,
        inventoryHolds,
        executedLease,
      },
    };
  });

  logger.trace({ ctx, partyId, timeExpend: now() - startTime }, 'getAllQuotesByPartyId finished!');

  return partyQuotes;
};

const getFeesForSelectedRecurringAndOneTimeCharges = (additionalAndOneTimeChargesGroups, selectedRecurringAndOneTimeChargesGroup) => {
  const feesCorrespondingToSelectedPeriod = additionalAndOneTimeChargesGroups.find(
    feePeriodGroup => selectedRecurringAndOneTimeChargesGroup.name === feePeriodGroup.name,
  );
  if (!feesCorrespondingToSelectedPeriod) {
    return getRecurringAndOneTimeChargesObject([]);
  }

  const selectedFees = selectedRecurringAndOneTimeChargesGroup.fees;
  const fees = feesCorrespondingToSelectedPeriod.fees.reduce((result, fee) => {
    const extractedFeeId = extractFeeId(fee);
    const _selectedFee = selectedFees.find(selectedFee => extractFeeId(selectedFee) === extractedFeeId);
    if (_selectedFee) {
      let displayName = fee.displayName;
      const parentQuantity = _selectedFee.quantity > 1 ? `${_selectedFee.quantity} ` : '';
      if (fee.parentFeeDisplayName) {
        displayName =
          fee.quoteSectionName === 'deposit'
            ? `${displayName} (${parentQuantity}${fee.parentFeeDisplayName})`
            : `${parentQuantity}${displayName} (${fee.parentFeeDisplayName})`;
      } else {
        displayName = `${parentQuantity}${displayName}`;
      }
      fee.concessions = _selectedFee.selectedConcessions;
      result.push({
        ...fee,
        displayName,
        maxAmount: _selectedFee.maxAmount ? parseFloat(_selectedFee.maxAmount) : 0,
        amount: _selectedFee.amount ? parseFloat(_selectedFee.amount) : 0,
        quantity: _selectedFee.quantity,
        variableAdjustmentAmount: _selectedFee.variableAdjustmentAmount,
        originalTotalAmount: _selectedFee.originalTotalAmount,
        isMinAndMaxRentDiff: _selectedFee.isIGFee && !_selectedFee.isMinAndMaxRentEqual,
        relativeAmountsByLeaseTerm: _selectedFee.relativeAmountsByLeaseTerm,
      });
    }
    return result;
  }, []);
  return getRecurringAndOneTimeChargesObject(fees);
};

const getTotalCharges = (charges, baseRent) => charges.reduce((total, charge) => total + ((charge && charge.amount) || 0), 0) + baseRent;

export const getPublishedQuoteDataWithMonthlyTotalCharges = publishedQuoteData => {
  const leaseTerms = publishedQuoteData.leaseTerms.map(term => ({
    ...term,
    totalMonthlyCharges: getTotalCharges(publishedQuoteData.additionalAndOneTimeCharges.additionalCharges || [], term.adjustedMarketRent || 0),
  }));
  return { ...publishedQuoteData, leaseTerms };
};

const isTheAllowBaseRentAdjustmentFlagEnabled = async ctx => {
  const { settings } = await getTenant(ctx);
  return settings.quote && settings.quote.allowBaseRentAdjustmentFlag;
};

const getRmsPricingAndLeaseTerms = async (ctx, quote) => {
  const rmsPricing = (await getRMSPricingWithAdjustments(ctx, quote)) || {};
  const leaseTerms = await getLeaseTermsForQuote(ctx, quote);

  return { rmsPricing, leaseTerms };
};

const getQuoteById = async (ctx, quoteId, fksToExpand) => {
  const quote = await getOne(ctx, 'Quote', quoteId, fksToExpand);
  validateQuote(quote);

  const { propertyTimezone: tz } = quote;
  const propertyTimezone = tz || LA_TIMEZONE;

  const { rmsPricing, leaseTerms } = await getRmsPricingAndLeaseTerms(ctx, quote);
  quote.leaseTerms = leaseTerms;

  if (rmsPricing) {
    quote.rentMatrix = rmsPricing.rentMatrix;
    quote.renewalDate = rmsPricing.renewalDate;
    const { defaultLeaseStartDate } = getDefaultStartDateAndLeaseLength(rmsPricing);
    quote.defaultLeaseStartDate = defaultLeaseStartDate;
  }
  quote.partyMembers = await getPartyMembersByQuoteId(ctx, quoteId);
  const isRenewalQuote = quote.leaseState === DALTypes.LeaseState.RENEWAL;
  const additionalCharges = quote?.publishedQuoteData?.additionalAndOneTimeCharges?.additionalCharges || [];
  quote.additionalAndOneTimeCharges = quote.leaseTerms.length
    ? await getAndFormatAdditionalAndOneTimeChargesByperiod(ctx, {
        additionalCharges,
        inventoryId: quote.inventoryId,
        leaseTerms: quote.leaseTerms,
        propertyTimezone,
        isRenewalQuote,
      })
    : null;

  if (quote.publishedQuoteData) {
    quote.publishedQuoteData = getPublishedQuoteDataWithMonthlyTotalCharges(quote.publishedQuoteData);
    quote.publishedQuoteData.isExpired = now({ timezone: propertyTimezone }).isAfter(toMoment(quote.expirationDate, { timezone: propertyTimezone }));
  }

  quote.allowBaseRentAdjustment = await isTheAllowBaseRentAdjustmentFlagEnabled(ctx);
  return quote;
};

const selectQuoteData = quote => {
  const dataToSelectFromQuote = [
    'inventoryId',
    'leaseTerms',
    'created_at',
    'updated_at',
    'publishDate',
    'expirationDate',
    'leaseStartDate',
    'confirmationNumber',
    'additionalAndOneTimeCharges',
    'propertyTimezone',
    'defaultLeaseStartDate',
    'partyId',
    'id',
    'leaseState',
  ];

  return pick(quote, dataToSelectFromQuote);
};

const getQuoteDraft = async (ctx, quoteId) => await getQuoteById(ctx, quoteId);

const getPublishedQuote = async (ctx, quoteId, personId) => {
  const myLogCtx = { ctx, quoteId, personId };
  const fksToExpand = {
    partyId: {
      rel: 'Party',
      repr: 'party',
      fields: ['userId', 'leaseType', 'assignedPropertyId'],
    },
  };
  const quote = await getQuoteById(ctx, quoteId, fksToExpand);
  logger.trace(myLogCtx, 'got quote');
  if (!quote) throw new Error(`No quote found for id ${quoteId}`);

  if (quote.publishedQuoteData) {
    quote.publishedQuoteData.applyNowUrl = await getApplyNowUrlForPublishedQuote(ctx, {
      id: quoteId,
      partyMembers: personId ? quote.partyMembers.filter(pm => pm.personId === personId) : quote.partyMembers,
      propertyId: quote.party.assignedPropertyId,
    });
    const { party = {} } = quote;
    const { userId } = party;

    if (!quote.publishedQuoteData.leasingAgent) {
      quote.publishedQuoteData.leasingAgent = await loadUserById(ctx, userId);
    }
  } else {
    logger.trace(myLogCtx, `no published quote found for id ${quoteId}`);
  }

  return quote.publishedQuoteData;
};

const deleteQuoteById = async (ctx, id) => {
  logger.info({ ctx, quoteId: id }, 'deleting quote');

  const fksForQuote = {
    inventoryId: {
      rel: 'Inventory',
      repr: 'inventory',
      fields: ['name'],
    },
  };
  const fksForInventory = {
    propertyId: {
      repr: 'property',
      rel: 'Property',
    },
  };
  const quote = await getOne(ctx, 'Quote', id, fksForQuote, ['id', 'publishDate', 'partyId', 'inventoryId']);
  validateQuote(quote);

  const inventory = await getOne(ctx, 'Inventory', quote.inventoryId, fksForInventory);
  inventory.building = await getOne(ctx, 'Building', inventory.buildingId);

  if (quote.publishDate) {
    throw new ServiceError({
      token: 'PUBLISHED_QUOTE_CAN_NOT_BE_DELETED',
      status: 412,
    });
  }
  await dal.deleteQuoteById(ctx, id);
  const unitShortHand = getUnitShortHand(inventory);
  await logEntityRemoved(ctx, { ...quote, unitShortHand, inventoryName: quote.inventory.name }, COMPONENT_TYPES.QUOTE);
  logger.debug({ ctx, quoteId: id }, 'quote deletion completed');
  await notifyQuotesUpdated(ctx, quote.partyId);
};

const validatePricesOnInventory = async (ctx, quote, { rentMatrix, leaseTerms } = {}) => {
  logger.trace({ ctx, quoteId: quote?.id, leaseTermIds: leaseTerms?.map(lt => lt.id).join(', ') }, 'validatePricesOnInventory');
  const { inventoryId, partyId, leaseStartDate, leaseState, propertyTimezone, selections = {} } = quote;

  if (!inventoryId || !partyId) return;

  const inventory = await getInventoryById(ctx, {
    id: inventoryId,
    expand: true,
  });
  const { adjustedMarketRent, isRenewal } = await getMarketRentInfoForUnit(ctx, inventory, {
    property: inventory.property,
    partyId,
  });

  if (shouldEnableQuoteAction({ adjustedMarketRent, isRenewal }, { leaseState })) {
    if (!selections || !selections.selectedLeaseTerms) return;

    if (
      isAValidLeaseStartDateInRentMatrix({
        leaseStartDate,
        rentMatrix,
        propertyTimezone,
        leaseTerms: filterSelectedLeaseTerms(leaseTerms, selections.selectedLeaseTerms),
      })
    ) {
      return;
    }
  }

  logger.debug({ ctx, inventoryId, partyId, selections, rentMatrix, leaseTerms }, 'Inventory with unavailable prices');
  throw new ServiceError({ token: 'INVENTORY_WITH_UNAVAILABLE_PRICES', status: 412 });
};

const createQuote = async (ctx, data) => {
  // TODO: we should pass only the ids here, it is a risk that we allow the
  // inventoryName being sent from the frontend same as unitShortHand
  const { inventoryId, partyId, inventoryName, defaultStartDate, unitShortHand, createdFromCommId, isRenewalQuote } = data;
  const myLogCtx = {
    ctx,
    inventoryId,
    partyId,
    inventoryName,
    defaultStartDate: defaultStartDate || null,
    unitShortHand,
  };

  const propertyTimezone = await getPropertyTimezoneFromInventoryId(ctx, inventoryId);

  if (!inventoryId) {
    throw new ServiceError({ token: 'INVENTORY_ID_IS_NEEDED' });
  }

  if (!partyId) {
    throw new ServiceError({ token: 'PARTY_ID_IS_NEEDED' });
  }

  if (!propertyTimezone) {
    throw new ServiceError({ token: 'NO_PROPERTY_TIMEZONE' });
  }

  await validateActionOnInventory(ctx, ActionTypes.QUOTE_UNIT, {
    inventoryId,
    partyId,
  });

  const leaseState = isRenewalQuote ? DALTypes.LeaseState.RENEWAL : DALTypes.LeaseState.NEW;
  await validatePricesOnInventory(ctx, { inventoryId, partyId, propertyTimezone, leaseState });

  const [existingDraft] = await dal
    .getQuotes(ctx)
    .where({
      inventoryId,
      partyId,
      publishDate: null,
    })
    .select('id');

  if (existingDraft && existingDraft.id) {
    throw new ServiceError({
      token: 'MULTIPLE_QUOTE_DRAFT_NOT_ALLOWED',
      status: 412,
      data: { quoteId: existingDraft.id },
    });
  }

  try {
    // TODO return only the needed keys
    // to put it simple: do not return {created,updated}_at|
    const quote = await dal.saveQuote(ctx, {
      inventoryId,
      partyId,
      propertyTimezone,
      createdFromCommId,
      leaseState,
    });

    logger.debug({ ...myLogCtx, quoteId: quote.id }, 'created new quote draft');

    // TODO: this should be better done using a mediator
    // like:
    // mediator.on('quote:created', () => markUnitsAsFavorite(ctx, partyId, [inventoryId]));
    await markUnitsAsFavorite(ctx, partyId, [inventoryId]);

    const createdByType = quote.createdFromCommId ? DALTypes.CreatedByType.SELF_SERVICE : DALTypes.CreatedByType.USER;

    await logEntityAdded(ctx, {
      entity: {
        ...quote,
        unitShortHand,
        inventoryName,
        leaseStartDate: defaultStartDate,
        createdByType,
      },
      component: COMPONENT_TYPES.QUOTE,
      subComponent: getLogSubComponent(leaseState),
    });

    await saveQuoteCreatedEvent(ctx, {
      partyId,
      userId: (ctx.authUser || {}).id,
    });

    const { rmsPricing, leaseTerms } = await getRmsPricingAndLeaseTerms(ctx, quote);
    const { defaultLeaseStartDate, defaultLeaseLengths } = getDefaultStartDateAndLeaseLength(rmsPricing);

    const rmsPricingData = rmsPricing ? pick(rmsPricing, ['rentMatrix', 'renewalDate']) : {};
    return {
      ...quote,
      leaseTerms,
      defaultLeaseStartDate,
      defaultLeaseLengths,
      additionalAndOneTimeCharges: leaseTerms.length
        ? await getAdditionalOneTimeFeesByPeriod(ctx, { inventoryId, leaseTerms, propertyTimezone, isRenewalQuote })
        : [],
      allowBaseRentAdjustment: await isTheAllowBaseRentAdjustmentFlagEnabled(ctx),
      ...rmsPricingData,
    };
  } catch (err) {
    logger.error({ err, ...myLogCtx }, 'Error saving quote');
    throw new ServiceError('ERROR_SAVING_QUOTE');
  }
};

export const getRentableItemsForRenewalLease = async (ctx, quoteId) => {
  const fksToExpand = {
    inventoryId: {
      rel: 'Inventory',
      repr: 'inventory',
      fields: ['id', 'inventoryGroupId'],
    },
  };
  const quote = await getOne(ctx, 'Quote', quoteId, fksToExpand);

  const { propertyTimezone: tz } = quote;
  const propertyTimezone = tz || LA_TIMEZONE;

  const { leaseTerms = [] } = await getRmsPricingAndLeaseTerms(ctx, quote);
  const isRenewalQuote = quote.leaseState === DALTypes.LeaseState.RENEWAL;

  const [complimentaryItems, inventoryFees] = await Promise.all([
    getComplimentsForInventory(ctx, quote.inventory, isRenewalQuote),
    ...(leaseTerms.length ? [getAdditionalOneTimeFeesByPeriod(ctx, { inventoryId: quote.inventoryId, leaseTerms, propertyTimezone, isRenewalQuote })] : []),
  ]);

  const { fees = [] } = (inventoryFees || []).find(it => it.name === DALTypes.LeasePeriod.MONTH) || {};
  const renewalFees = fees
    .filter(it => it.renewalLetterDisplayFlag)
    .map(fee => {
      updateFeeAmountToInventoryGroupFeeOrFeeAmount(fee);
      setDefaultVariableAmount(fee, fee.amount);

      return {
        displayName: fee.displayName,
        amount: fee.amount,
      };
    });

  const complimentaryFees = complimentaryItems.map(it => ({
    displayName: it.name,
    amount: it.basePriceMonthly,
  }));

  return [].concat(renewalFees, complimentaryFees);
};

export const getRawQuoteById = async (ctx, quoteId) => await getOne(ctx, 'Quote', quoteId);

const getSelectedLeaseTermsWithoutManuallyAdjustedBaseRent = selectedLeaseTerms =>
  selectedLeaseTerms.map(term => omit(term, ['originalBaseRent', 'overwrittenBaseRent']));

const duplicateQuote = async (ctx, quoteId) => {
  const fksToExpand = {
    inventoryId: {
      rel: 'Inventory',
      repr: 'inventory',
      fields: ['name'],
    },
  };
  logger.info({ ctx, quoteId }, 'Duplicating quote');

  const quote = await getQuoteById(ctx, quoteId, fksToExpand);
  const { inventoryId, partyId, selections, propertyTimezone, leaseState, leaseStartDate } = quote;

  if (!inventoryId || !partyId) {
    throw new ServiceError('INVENTORY_ID_IS_NEEDED');
  }
  const [existingDraft] = await dal
    .getQuotes(ctx)
    .where({
      inventoryId,
      partyId,
      publishDate: null,
    })
    .select('id');

  if (existingDraft && existingDraft.id) {
    logger.debug({ ctx, quoteId, existingDraftId: existingDraft.id }, 'Unable to duplicate because of existing draft');
    throw new ServiceError({
      token: 'MULTIPLE_QUOTE_DRAFT_NOT_ALLOWED',
      status: 412,
      data: {
        quoteId: existingDraft.id,
      },
    });
  }

  const { rmsPricing, leaseTerms } = await getRmsPricingAndLeaseTerms(ctx, quote);
  logger.trace({ rmsPricingId: rmsPricing?.id }, 'starting validatePricesOnInventory');
  await validatePricesOnInventory(ctx, quote, { rentMatrix: rmsPricing && rmsPricing.rentMatrix, leaseTerms });

  try {
    selections.selectedLeaseTerms = getSelectedLeaseTermsWithoutManuallyAdjustedBaseRent(selections.selectedLeaseTerms);
    const savedQuote = await dal.saveQuote(ctx, {
      leaseStartDate,
      inventoryId,
      partyId,
      selections,
      propertyTimezone,
      leaseState,
    });

    const fksForInventory = {
      propertyId: {
        repr: 'property',
        rel: 'Property',
      },
    };

    const { defaultLeaseStartDate } = getDefaultStartDateAndLeaseLength(rmsPricing);
    const inventory = await getOne(ctx, 'Inventory', quote.inventoryId, fksForInventory);
    const unitShortHand = getUnitShortHand(inventory);
    await logEntity(ctx, {
      entity: {
        ...savedQuote,
        unitShortHand,
        existingQuoteId: quote.id,
        inventoryName: quote.inventory.name,
      },
      activityType: ACTIVITY_TYPES.DUPLICATE,
      component: COMPONENT_TYPES.QUOTE,
    });
    await notifyQuotesUpdated(ctx, partyId);
    const isRenewalQuote = quote.leaseState === DALTypes.LeaseState.RENEWAL;
    return {
      ...savedQuote,
      defaultLeaseStartDate,
      rentMatrix: rmsPricing && rmsPricing.rentMatrix,
      leaseTerms,
      additionalAndOneTimeCharges: leaseTerms.length
        ? await getAdditionalOneTimeFeesByPeriod(ctx, { inventoryId, leaseTerms, propertyTimezone, isRenewalQuote })
        : [],
    };
  } catch (err) {
    logger.error({ err, ctx, quoteId }, 'Error duplicating quote');
    throw new ServiceError('ERROR_SAVING_QUOTE');
  }
};

const isBaseRentEdited = (editedTerm, leaseTerm) =>
  editedTerm.overwrittenBaseRent && isEqual(editedTerm.id, leaseTerm.id) && !isEqual(editedTerm.overwrittenBaseRent, leaseTerm.overwrittenBaseRent);

const leaseTermsNewRent = (selectedLeaseTerms, leaseTerms) =>
  selectedLeaseTerms.reduce((acc, editedTerm) => {
    leaseTerms.forEach(leaseTerm => {
      if (isBaseRentEdited(editedTerm, leaseTerm)) {
        acc.push({
          overwrittenBaseRent: editedTerm.overwrittenBaseRent,
          termLength: leaseTerm.termLength,
        });
      }
    });

    return acc;
  }, []);

const getEditedBaseRents = (selectedLeaseTerms, quote) => {
  if (!selectedLeaseTerms.length) return [];

  const leaseTerms = !quote.publishedQuoteData ? quote.leaseTerms : quote.publishedQuoteData.leaseTerms;
  return leaseTermsNewRent(selectedLeaseTerms, leaseTerms);
};

const getEditedQuoteFields = (editedQuote, quote) => {
  const editedQuoteFields = {};
  const editedFields = reduce(
    editedQuote,
    (result, value, key) => {
      value = key === 'leaseStartDate' && value ? new Date(value).getTime() : value;
      if (editedQuote[key] !== null && typeof editedQuote[key] === 'object') {
        return isEqual(value, quote[key]) ? result : result.concat(key);
      }
      if (key === 'leaseStartDate') {
        if (quote[key] && value !== new Date(quote[key]).getTime()) {
          editedQuoteFields[key] = editedQuote[key];
        }
      } else if (value !== quote[key]) {
        editedQuoteFields[key] = value;
      }
      return result;
    },
    [],
  );

  const hasEditedFieldsAndSelections = editedFields.length && editedQuote.selections;

  if (hasEditedFieldsAndSelections) {
    reduce(
      editedQuote.selections,
      (result, value, key) => {
        if (key === 'selectedLeaseTerms') {
          editedQuoteFields.leaseTermsBaseRent = getEditedBaseRents(value, quote);
        }

        if (quote.selections && !isEqual(value, quote.selections[key])) {
          editedQuoteFields[key] = value;
        }
        return result;
      },
      [],
    );
  }

  return editedQuoteFields;
};

const addToChargeConcessions = (concession, chargeConcessions, dataToSelectFromChargeConcessions) => {
  const concessionSelectedData = pick(concession, dataToSelectFromChargeConcessions);
  const amount = concession.relativeAmount ? (concession.relativeAmount * 100) / Math.abs(concession.relativeAdjustment) : concession.parentFeeAmount;
  chargeConcessions.push(
    Object.assign(concessionSelectedData, {
      computedValue: getConcessionValue(concession, { amount, length: 1 }),
    }),
  );
};

const updateAdditionalChargeConcessions = (additionalCharge, chargeConcessions, dataToSelectFromChargeConcessions) => {
  additionalCharge.concessions.forEach(concession => {
    concession.parentFeeDisplayName = additionalCharge.displayName;
    concession.parentFeeAmount = additionalCharge.amount;
    addToChargeConcessions(concession, chargeConcessions, dataToSelectFromChargeConcessions);
  });
};

const updateAdditionalCharges = (additionalCharges, chargeConcessions, dataToSelectFromChargeConcessions) => {
  if (additionalCharges) {
    additionalCharges.forEach(additionalCharge => {
      updateAdditionalChargeConcessions(additionalCharge, chargeConcessions, dataToSelectFromChargeConcessions);
    });
  }
};

const sendPublishedQuoteToScreen = async (ctx, quote) => {
  const message = {
    tenantId: ctx.tenantId,
    quoteId: quote.id,
    partyId: quote.partyId,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: SCREENING_MESSAGE_TYPE.QUOTE_PUBLISHED,
    message,
    ctx,
  });
};

const updateFiltersFromQuote = async (ctx, quote) => {
  const party = await loadPartyById(ctx, quote.partyId);
  const { moveInDate } = party.storedUnitsFilters || {};
  if (moveInDate && moveInDate.min) return;

  logger.info(
    { ctx, partyId: party.id, quoteId: quote.id, leaseStartDate: quote.leaseStartDate },
    'updating party move in date range based on lease start date selected in the quote',
  );

  const minDate = quote.leaseStartDate ? toMoment(quote.leaseStartDate, { timezone: quote.propertyTimezone }) : undefined;

  const entity = {
    id: party.id,
    storedUnitsFilters: {
      ...(party.storedUnitsFilters || {}),
      // moveInDate: {
      //   min: minDate,
      //   max: minDate.clone().add(1, 'month'),
      // },
    },
  };

  if (isMoment(minDate)) {
    entity.storedUnitsFilters = {
      ...entity.storedUnitsFilters,
      moveInDate: {
        min: minDate,
        max: minDate.clone().add(1, 'month'),
      },
    };
  }

  await updateParty(ctx, entity);

  notify({ ctx, event: eventTypes.PARTY_UPDATED, data: { partyId: party.id } });
};

const getAdditionalPublishedQuoteData = async (ctx, quote, publishedQuoteData) => {
  const additionalPublishedQuoteData = { ...publishedQuoteData };
  const { party = {} } = quote;
  const isCorporate = isACorporateParty(party);
  const { userId, leaseType, workflowName } = party;
  additionalPublishedQuoteData.userId = userId;
  additionalPublishedQuoteData.leaseType = leaseType;
  additionalPublishedQuoteData.leasingAgent = await loadUserById(ctx, userId);
  additionalPublishedQuoteData.screeningRequired = isScreeningRequired(isCorporate, workflowName);

  return additionalPublishedQuoteData;
};

const updateQuoteById = async (ctx, id, data) => {
  const updatedQuoteData = await runInTransaction(async trx => {
    const innerCtx = { ...ctx, trx };
    const myLogCtx = { ctx, quoteId: id, quoteData: data };
    logger.debug(myLogCtx, 'updateQuoteById');

    const fksToExpand = {
      partyId: {
        rel: 'Party',
        repr: 'party',
        fields: ['userId', 'leaseType', 'assignedPropertyId', 'workflowName'],
      },
    };

    let quote = await getQuoteById(innerCtx, id, fksToExpand);
    const { partyId } = quote;

    const { propertyTimezone } = quote;

    const editedQuoteFields = getEditedQuoteFields(data, quote);
    // these fields should not be overwritten
    // expirationDate should be set by us not by the client
    const forbiddenKeys = [
      'id',
      'inventoryId',
      'partyId',
      'publishDate', // this one will be set by us too
      'expirationDate',
      'propertyTimezone',
    ];

    // allowed keys
    difference(Object.keys(quote), forbiddenKeys).forEach(key => {
      if (key in data) {
        quote[key] = data[key];
      }
    });

    if (!propertyTimezone) {
      logger.error(myLogCtx, 'propertyTimezone null or empty');
      throw new Error('propertyTimezone null or empty');
    }

    const { inventoryId } = quote;

    if (await isInventoryPriceUnavailable(innerCtx, inventoryId)) {
      const party = await loadPartyById(innerCtx, partyId);
      await notify({
        ctx: innerCtx,
        event: eventTypes.QUOTE_PUBLISHED_FAILED,
        data: { partyId },
        routing: { teams: [party.ownerTeam, ...party.teams] },
      });

      throw new ServiceError({
        token: 'Error loading price on this unit. No price available',
        status: 404,
      });
    }

    // publishDate is an especial case
    // it should be set once
    if (data.publishDate) {
      // if it already has a value, we should raise a precondition error
      if (quote.publishDate) {
        throw new ServiceError({
          token: 'QUOTE_IS_ALREADY_PUBLISHED',
          status: 412,
        });
      }

      // in order to be published, the quote should already
      // have a leaseStartDate
      if (!quote.leaseStartDate) {
        throw new ServiceError({
          token: 'QUOTE_CAN_NOT_BE_PUBLISHED',
          status: 412,
        });
      }

      quote.publishDate = now({ timezone: propertyTimezone });

      // is it correct to pass the expiration period from the frontend?
      // shouldn't we read this value from the configuration in the backend?
      quote.expirationDate = quote.publishDate.clone().endOf('day').add(data.expirationPeriod, 'days');
      quote.confirmationNumber = getUUID();
    } else if (quote.publishDate) {
      throw new ServiceError({
        token: 'QUOTE_IS_ALREADY_PUBLISHED',
        status: 412,
      });
    }

    const { publishDate, expirationDate, selections, confirmationNumber, leaseStartDate } = quote;
    const rmsPricingAndLeaseTerms = await getRmsPricingAndLeaseTerms(innerCtx, quote);
    const { rmsPricing } = rmsPricingAndLeaseTerms;
    let { leaseTerms } = rmsPricingAndLeaseTerms;
    logger.trace({ rmsPricingId: rmsPricing?.id }, 'starting validatePricesOnInventory');
    quote.publishDate && (await validatePricesOnInventory(innerCtx, quote, { rentMatrix: rmsPricing && rmsPricing.rentMatrix, leaseTerms }));

    quote.rentMatrix = rmsPricing && rmsPricing.rentMatrix;

    let additionalAndOneTimeCharges = {};

    if (selections && selections.selectedLeaseTerms) {
      leaseTerms = filterSelectedLeaseTerms(leaseTerms, selections.selectedLeaseTerms);

      if (leaseStartDate) {
        const selectedLeaseTermIds = selections.selectedLeaseTerms.map(selected => selected.id);
        const { rentMatrix } = quote;
        const leaseTermsWithRmsPricing = updateLeaseTermsWithMatrixRents({ selectedLeaseTermIds, leaseStartDate, rentMatrix }, leaseTerms, propertyTimezone);

        if ((getLeaseTermsWithoutRent(leaseTermsWithRmsPricing, selectedLeaseTermIds) || []).length) {
          throw new ServiceError({
            token: 'PRICE_FOR_SELECTED_LEASE_TERM_AND_START_DATE_IS_UNAVAILABLE',
            status: 404,
          });
        }
      }

      const savedLeaseTerms = quote.publishedQuoteData?.leaseTerms || leaseTerms;

      quote.leaseTerms = mapSelectedLeaseTermsAndConcessions(savedLeaseTerms, selections.selectedLeaseTerms);

      additionalAndOneTimeCharges = selections.selectedAdditionalAndOneTimeCharges
        ? getFeesForSelectedRecurringAndOneTimeCharges(quote.additionalAndOneTimeCharges, selections.selectedAdditionalAndOneTimeCharges)
        : {};
    }

    const dataToSelectFromFees = [
      'id',
      'displayName',
      'name',
      'quantity',
      'amount',
      'maxAmount',
      'price',
      'estimated',
      'originalTotalAmount',
      'variableAdjustmentAmount',
      'parentFeeDisplayName',
      'parentFeeAmount',
      'quoteSectionName',
      'isMinAndMaxRentDiff',
      'relativeAmountsByLeaseTerm',
      'concessions',
    ];

    // Removing data not necessary for the published quote render
    if (additionalAndOneTimeCharges.additionalCharges) {
      additionalAndOneTimeCharges.additionalCharges = additionalAndOneTimeCharges.additionalCharges.map(fee => pick(fee, dataToSelectFromFees));
    }

    if (additionalAndOneTimeCharges.oneTimeCharges) {
      additionalAndOneTimeCharges.oneTimeCharges = additionalAndOneTimeCharges.oneTimeCharges.map(fee => pick(fee, dataToSelectFromFees));
    }

    const dataToSelectFromChargeConcessions = [
      'amount',
      'optional',
      'displayName',
      'computedValue',
      'recurring',
      'variableAdjustment',
      'absoluteAdjustment',
      'recurringCount',
      'amountVariableAdjustment',
      'relativeAmount',
      'parentFeeDisplayName',
      'bakedIntoAppliedFeeFlag',
    ];

    leaseTerms.forEach(term => {
      term.chargeConcessions = [];
      updateAdditionalCharges(additionalAndOneTimeCharges.additionalCharges, term.chargeConcessions, dataToSelectFromChargeConcessions);
      updateAdditionalCharges(additionalAndOneTimeCharges.oneTimeCharges, term.chargeConcessions, dataToSelectFromChargeConcessions);
    });

    const selectedQuoteData = selectQuoteData(quote);

    let publishedQuoteData = {
      ...selectedQuoteData,
      leaseTerms,
      additionalAndOneTimeCharges,
      propertyTimezone,
      rentMatrix: rmsPricing && rmsPricing.rentMatrix,
    };

    if (publishedQuoteData.publishDate) {
      publishedQuoteData.leaseTerms = leaseTerms.map(leaseTerm => updateTermWithMatrixRents(leaseTerm, leaseStartDate, quote.rentMatrix, propertyTimezone));
      const additionalPublishedQuoteData = await getAdditionalPublishedQuoteData(ctx, quote, publishedQuoteData);
      publishedQuoteData = { ...publishedQuoteData, ...additionalPublishedQuoteData };
    }

    const isPublishingRenewalQuoteWithoutOneMonthPrice =
      quote.leaseState === DALTypes.LeaseState.RENEWAL && publishedQuoteData.publishDate && !quote.rentMatrix['1'];

    if (isPublishingRenewalQuoteWithoutOneMonthPrice) {
      const exceptionReportData = {
        reportData: { partyId: quote.partyId, inventoryId, rentMatrix: quote.rentMatrix },
      };
      await createExceptionReport(ctx, exceptionReportData, OtherExceptionReportRules.RENEWAL_LETTER_PUBLISHED_WITHOUT_ONE_MONTH_LEASE_TERM);
    }

    const quoteToSave = {
      leaseStartDate,
      publishDate,
      expirationDate,
      selections,
      confirmationNumber,
      publishedQuoteData,
    };

    const { selectedLeaseTerms = [] } = selections || {};
    if (!publishDate && (!leaseStartDate || !selectedLeaseTerms.length)) {
      logger.trace(myLogCtx, 'Removing quote as there is no lease terms or lease start date selected');
      await deleteQuoteById(innerCtx, id);
      return { partyId };
    }

    !publishDate && delete quoteToSave.publishedQuoteData;

    try {
      [quote] = await dal.updateQuoteById(innerCtx, id, quoteToSave).returning('*');
    } catch (err) {
      if (err.code === 'P0001') {
        // error that comes from DB trigger
        throw new ServiceError({
          token: 'QUOTE_IS_ALREADY_PUBLISHED',
          status: 412,
        });
      }
      throw err;
    }

    // this is because from time to time we are facing concurrency issues. (the user delete a quote and at the same time another one update it).
    // also at the begining of this method we get the quote by id and if it is not found we throw an error INVALID_QUOTE_ID
    if (!quote?.id) {
      logger.warn({ ...myLogCtx, partyId }, 'Trying to update an unexisting quote');
      return { partyId };
    }

    await updateFiltersFromQuote(innerCtx, quote);

    if (publishedQuoteData.publishDate) {
      await sendPublishedQuoteToScreen(innerCtx, quote);
    }

    const subComponentType = getLogSubComponent(quote.leaseState);
    const { unitShortHand, inventoryName } = data;
    if (!data.publishDate) {
      const selectedLeaseTermsLength = getTermLengths(leaseTerms).join(',');
      await logEntity(innerCtx, {
        entity: {
          ...quote,
          unitShortHand,
          inventoryName,
          selectedLeaseTermsLength,
          edited: editedQuoteFields,
        },
        activityType: ACTIVITY_TYPES.UPDATE,
        component: COMPONENT_TYPES.QUOTE,
        subComponent: subComponentType,
      });
    } else {
      await logEntity(innerCtx, {
        entity: { ...quote, unitShortHand, inventoryName },
        activityType: ACTIVITY_TYPES.PUBLISH,
        component: COMPONENT_TYPES.QUOTE,
        subComponentType,
      });
      await saveQuotePublishedEvent(innerCtx, { partyId, userId: (ctx.authUser || {}).id, metadata: { quoteId: quote.id } });
    }

    logger.debug(myLogCtx, 'Completed updateQuoteById');
    await notifyQuotesUpdated(innerCtx, partyId);

    return {
      quote,
      leaseTerms,
      propertyTimezone,
      partyId,
    };
  }, ctx);

  const { quote, partyId, leaseTerms, propertyTimezone } = updatedQuoteData;
  if (!quote) return { partyId };
  const { leaseState } = quote;
  const isRenewalQuote = leaseState === DALTypes.LeaseState.RENEWAL;
  return {
    ...quote,
    leaseTerms,
    additionalAndOneTimeCharges: leaseTerms.length
      ? await getAdditionalOneTimeFeesByPeriod(ctx, { inventoryId: quote.inventoryId, leaseTerms, propertyTimezone, isRenewalQuote })
      : null,
  };
};

const printQuote = async (ctx, data) => {
  logger.trace({ ctx, data }, 'printQuote');
  const { id: quoteId, partyId } = data;
  const { leaseState } = await getQuoteById(ctx, quoteId);
  await logEntity(ctx, {
    entity: data,
    activityType: ACTIVITY_TYPES.PRINT,
    component: COMPONENT_TYPES.QUOTE,
    subComponentType: getLogSubComponent(leaseState),
  });
  await saveQuotePrintedEvent(ctx, {
    partyId,
    userId: (ctx.authUser || {}).id,
    quoteId,
    metadata: {
      quoteId,
      isQuotePrinted: true,
    },
  });
};

export const getPublishQuotesData = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'getPublishQuotesData');
  const quotes = await dal.getPublishedQuotesByPartyId(ctx, partyId);
  return quotes.map(quote => ({ id: quote.id, ...quote.publishedQuoteData }));
};

export const sendQuoteMailEvent = async (ctx, data) => {
  const { quoteId, partyId, context, personIds = [] } = data;
  logger.trace({ ctx, quoteId, partyId, personIds }, 'sendQuoteMailEvent');

  const { host, tenantDomain } = ctx;
  const hostname = host || tenantDomain || '';
  const partyWorkflowName = await getPartyWorkflowByPartyId(ctx, partyId);
  const { id: propertyId } = await dal.getPropertyByQuoteId(ctx, quoteId);

  const isRenewal = partyWorkflowName === DALTypes.WorkflowName.RENEWAL;
  const sendQuoteEmailEnabled = !isRenewal ? await getAppSettingValue(ctx, 'SendQuoteEmail') : await getAppSettingValue(ctx, 'SendRenewalLetterEmail');
  const quoteEmailTemplateName = !isRenewal
    ? await getAppSettingValue(ctx, DALTypes.QuoteEmailTemplateSettings.Quote)
    : ((await getCommsTemplateByPropertyIdAndTemplateSetting(ctx, propertyId, { section: 'QUOTE', action: 'RENEWAL_LETTER' })) || {}).name;

  let metadata = {
    quoteId,
    hostname,
    personIds,
    sendQuoteEmailEnabled,
    quoteEmailTemplateName,
  };
  if (context) metadata = { ...metadata, context };
  await saveQuoteMailSentEvent(ctx, {
    partyId,
    userId: (ctx.authUser || {}).id,
    metadata,
  });
};

export const sendQuoteEmail = async (ctx, emailInfo) => {
  const { context } = emailInfo;
  const sender = await getSenderInfo(ctx, emailInfo);
  const emailTemplateData = { ...emailInfo, sender, context };

  return await sendQuoteEmailComm(ctx, emailTemplateData);
};

export {
  createQuote,
  duplicateQuote,
  updateQuoteById,
  deleteQuoteById,
  selectQuoteData,
  getQuoteById,
  getQuoteDraft,
  getPublishedQuote,
  getAllQuotes,
  getAllQuotesByPartyId,
  printQuote,
};
