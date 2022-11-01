/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { DALTypes } from '../../common/enums/DALTypes';
import { getOne, getOneWhere } from '../database/factory';
import { getPropertyTimezone } from '../dal/propertyRepo';
import { getInventoryAmenities } from '../dal/inventoryRepo';
import { ServiceError } from '../common/errors';
import { getLeaseTermsByInventoryId, getLeaseNamesByPropertyId, getLeaseTermById as getLeaseTermByIdFromDb } from '../dal/leaseTermRepo';
import { validateIfElementsExist } from '../helpers/importUtils';
import { getConcessionsForLeaseTerms, replacePeriodInConcessions, updateConcessionsWithFloorCeilingAmount } from './concessions';
import logger from '../../common/helpers/logger';
import { calculateLeaseTermAdjustments } from './helpers/leaseTerms';

export const LEASE_NAMES_FIELD = 'leaseNames';
export const INVALID_LEASE_NAMES = 'INVALID_LEASE_NAME_ASSOCIATED';

export const validateLeaseNames = async (ctx, entityObj) => {
  const storedLeaseNames = await getLeaseNamesByPropertyId(ctx, entityObj.propertyId);
  const validateObj = {
    elementsStr: entityObj.leaseNames,
    storedElements: storedLeaseNames,
    columnName: LEASE_NAMES_FIELD,
    errorMessage: INVALID_LEASE_NAMES,
  };

  return await validateIfElementsExist(validateObj);
};

const getMarketRent = (ctx, { marketRentMonthly, marketRentWeekly, marketRentDaily, marketRentHourly }, period) => {
  switch (period) {
    case DALTypes.LeasePeriod.MONTH:
      return marketRentMonthly;
    case DALTypes.LeasePeriod.WEEK:
      return marketRentWeekly;
    case DALTypes.LeasePeriod.DAY:
      return marketRentDaily;
    case DALTypes.LeasePeriod.HOUR:
      return marketRentHourly;
    default:
      logger.error({ ctx, period }, 'Invalid lease period');
      throw new ServiceError('LEASE_TERM_WITHOUT_PERIOD');
  }
};

export const getUpdatedLeaseTermsWithMarketRent = async (ctx, inventoryId, leaseTerms, quoteSelections, leaseTermState) => {
  const quotesSelectionsObj = { ...quoteSelections, selectedAdditionalAndOneTimeCharges: quoteSelections.selectedAdditionalAndOneTimeCharges?.toString() };
  logger.trace(
    { ctx, inventoryId, leaseTermsId: leaseTerms?.map(leaseTerm => leaseTerm.id).join(', '), quotesSelectionsObj, leaseTermState },
    'getUpdatedLeaseTermsWithMarketRent',
  );

  if (!leaseTerms) {
    leaseTerms = await getLeaseTermsByInventoryId(ctx, inventoryId, leaseTermState);
  }

  const rmsPricingData = (await getOneWhere(ctx, 'RmsPricing', { inventoryId })) || {};

  return leaseTerms.map(leaseTerm => {
    const marketRent = parseFloat(getMarketRent(ctx, { marketRentMonthly: rmsPricingData.standardRent }, leaseTerm.period));

    return {
      ...leaseTerm,
      ...calculateLeaseTermAdjustments(ctx, leaseTerm, marketRent, quoteSelections),
    };
  });
};

const removeUnwantedPropertiesFromLeaseTerms = leaseTerms => leaseTerms.map(lt => omit(lt, 'relativeAdjustment', 'absoluteAdjustment'));

export const updateConcessionsFromSelections = (leaseTermId, quoteSelections, concessions) => {
  if (!quoteSelections || !quoteSelections.selectedLeaseTerms) {
    return concessions;
  }
  const selectedLeaseTerm = quoteSelections.selectedLeaseTerms.find(slt => slt.id === leaseTermId);
  if (!selectedLeaseTerm) {
    return concessions;
  }
  return concessions.map(concession => {
    const modifiedConcession = selectedLeaseTerm.concessions.find(c => c.id === concession.id);
    if (!modifiedConcession) {
      return concession;
    }
    concession.amountVariableAdjustment = modifiedConcession.amountVariableAdjustment;
    concession.relativeAmount = modifiedConcession.relativeAmount;
    concession.variableAmountUpdatedByAgent = modifiedConcession.variableAmountUpdatedByAgent;
    return concession;
  });
};

const logLeaseTermsWithConcessions = (ctx, leaseTerms, inventoryId, quoteSelections) => {
  let quoteSelectionObjLog = null;
  if (quoteSelections?.selectedAdditionalAndOneTimeCharges?.fees) {
    const { fees, ...rest } = quoteSelections.selectedAdditionalAndOneTimeCharges;
    quoteSelectionObjLog = { ...rest };
    quoteSelectionObjLog.feeIds = fees.map(fee => fee.id);
  }
  logger.trace({ ctx, leaseTermsId: leaseTerms?.map(leaseTerm => leaseTerm.id), inventoryId, quoteSelectionObjLog }, 'updateLeaseTermsWithConcessions');
};

export const updateLeaseTermsWithConcessions = async (ctx, { leaseTerms, inventoryId, createdAt, quoteSelections, leaseState }) => {
  logLeaseTermsWithConcessions(ctx, leaseTerms, inventoryId, quoteSelections);
  const inventory = await getOne(ctx, 'Inventory', inventoryId, {});
  const timezone = await getPropertyTimezone(ctx, inventory.propertyId);
  const amenities = await getInventoryAmenities(ctx, inventory);

  const leaseTermsMap = leaseTerms.reduce((acc, term) => {
    acc.set(term.id, term);
    return acc;
  }, new Map());

  const leaseTermsConcessions = await getConcessionsForLeaseTerms(ctx, { leaseTermsMap, inventory, amenities, createdAt, timezone, leaseState });

  return leaseTerms.map(leaseTerm => {
    let { concessions } = leaseTermsConcessions.find(termConcessions => termConcessions.leaseTermId === leaseTerm.id) || {
      concessions: [],
    };
    concessions = replacePeriodInConcessions(leaseTerm.period, concessions);
    concessions = updateConcessionsFromSelections(leaseTerm.id, quoteSelections, concessions);

    return { ...leaseTerm, concessions };
  });
};

export const updateLeaseTermsWithSpecial = (ctx, leaseTerms) => {
  logger.trace({ ctx, leaseTermsId: leaseTerms?.map(leaseTerm => leaseTerm.id).join(', ') }, 'updateLeaseTermsWithSpecial');

  return leaseTerms.map(l => {
    const specials = l.concessions.some(c => !c.hideInSelfService && !c.bakedIntoAppliedFeeFlag);
    return { ...l, specials };
  });
};

export const getLeaseTermById = (ctx, leaseTermId) => getLeaseTermByIdFromDb(ctx, leaseTermId);

export const getLeaseTermsForQuoteList = (ctx, { leaseTerms, rmsPricing, inventoryId, inventoryGroupId, leaseState, quoteSelections }) => {
  let quoteLeaseTerms = leaseTerms.filter(lt => lt.inventoryGroupId === inventoryGroupId && (!lt.state || lt.state === leaseState));

  const { standardRent } = rmsPricing.find(pricing => pricing.inventoryId === inventoryId && pricing.pricingType === leaseState) || {};

  quoteLeaseTerms = quoteLeaseTerms.map(leaseTerm => {
    const marketRent = standardRent ? parseFloat(getMarketRent(ctx, { marketRentMonthly: standardRent }, leaseTerm.period)) : null;
    const leaseTermAdjustments = marketRent ? calculateLeaseTermAdjustments(ctx, leaseTerm, marketRent, quoteSelections) : {};
    return {
      ...leaseTerm,
      ...leaseTermAdjustments,
    };
  });

  quoteLeaseTerms = removeUnwantedPropertiesFromLeaseTerms(quoteLeaseTerms);

  return quoteLeaseTerms;
};

export const getLeaseTermsForQuote = async (ctx, quote) => {
  logger.trace({ ctx, quoteId: quote?.id }, 'getLeaseTermsForQuote');

  const leaseTermState = quote.leaseState;
  let leaseTerms = await getLeaseTermsByInventoryId(ctx, quote.inventoryId, leaseTermState, true);
  leaseTerms = await updateLeaseTermsWithConcessions(ctx, {
    leaseTerms,
    inventoryId: quote.inventoryId,
    createdAt: quote.created_at,
    quoteSelections: quote.selections,
    leaseState: quote.leaseState,
  });
  leaseTerms = updateLeaseTermsWithSpecial(ctx, leaseTerms);

  leaseTerms = await getUpdatedLeaseTermsWithMarketRent(ctx, quote.inventoryId, leaseTerms, quote.selections || {}, leaseTermState);

  leaseTerms = removeUnwantedPropertiesFromLeaseTerms(leaseTerms);
  leaseTerms = updateConcessionsWithFloorCeilingAmount(leaseTerms);
  return leaseTerms;
};

export const filterSelectedLeaseTerms = (leaseTerms, selectedLeaseTerms) =>
  leaseTerms.reduce((result, term) => {
    const matchingLeaseTerm = selectedLeaseTerms.find(selected => selected.id === term.id);
    if (matchingLeaseTerm) {
      result.push({
        ...term,
        paymentSchedule: matchingLeaseTerm.paymentSchedule,
      });
    }
    return result;
  }, []);
