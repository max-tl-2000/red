/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import groupBy from 'lodash/groupBy';
import isEmpty from 'lodash/isEmpty';
import { reduce } from 'bluebird';
import { getRevaPricingByPropertyId, getRevaPricingByInventoryIds, getRevaPricing } from '../../../dal/revaPricingRepo';
import { getComplimentsPriceByInventoryIds } from '../../../dal/inventoryRepo';
import { buildUnitStructure } from '../helpers';
import { now, toMoment } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { getPropertyTimezone } from '../../../dal/propertyRepo';
import { calculatePartialAdjustedMarketRentWithNonVariableBakedFees } from '../../../../common/helpers/quotes';
import loggerModule from '../../../../common/helpers/logger';
import { throwCustomError } from '../../../common/errors';
import { RmsImportError } from '../../../../common/enums/enums';
import { DALTypes } from '../../../../common/enums/DALTypes';

const logger = loggerModule.child({ subType: 'REVA parser' });

const RMS_PROVIDER = 'REVA';

const getUnitPrices = (inventoryPrices = [], timezone) => {
  if (!inventoryPrices.length) return [];

  /** inventoryPrices contains inventory prices by lease term, but is the same inventoryId, in this case we take the first one. */
  const inventoryPrice = inventoryPrices[0];
  const { id, rmsExternalId, state: status, type, stateStartDate, availabilityDate } = inventoryPrice;

  const unitInfo = {
    externalId: rmsExternalId || id,
    fileName: '',
    rmsProvider: RMS_PROVIDER,
    availDate: now({ timezone }).format(YEAR_MONTH_DAY_FORMAT),
    status,
    amenityValue: 0,
    type,
  };

  const results = [unitInfo];
  // TODO: This is just temporary so that the training website outputs some prices for renewals.
  // We will have add a way to price for renewals from the spreadsheets at some point. The fact that we check for the state + no availability date
  // should prevent any impact on prod tenants
  if (type === DALTypes.InventoryType.UNIT && status === DALTypes.InventoryState.OCCUPIED_NOTICE && !availabilityDate) {
    results.push({ ...unitInfo, renewalDate: toMoment(stateStartDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT) });
  }

  return results;
};

const getPriceForMatrixAsRms = ({ startDate, rent }) => {
  let numOfRanges = 5;

  let priceMatrix = {};
  let newRent = rent;

  while (numOfRanges > 0) {
    priceMatrix = {
      ...priceMatrix,
      [startDate.format(YEAR_MONTH_DAY_FORMAT)]: {
        endDate: startDate.add(7, 'days').format(YEAR_MONTH_DAY_FORMAT),
        rent: newRent.toFixed(2),
      },
    };
    const twentyPercent = 0.2;
    newRent += newRent * twentyPercent;
    startDate.add(1, 'days');

    numOfRanges--;
  }

  return priceMatrix;
};

/**
 * This builds the price matrix key, the output will be something similar to:
 * @example
 * 1: { // Term length
 *      1900-01-01: { // Start date when the price begins to be applicable
 *        endDate: 2020-01-01, // End date when the price stops to be applicable
 *        rent: 4000, // Price
 *      }
 *    }
 * @param {moment} startDate - The current date time as a moment object
 * @param {Number} marketRentMonthly - The monthly price for a given inventory
 * @param {object} leaseTerm - The lease term object in which the marketRentMonthly applies
 */
const getPriceForMatrix = ({ startDate, marketRentMonthly, leaseTerm, isRevaPricingAsRms, complimentaryItemsAmount }) => {
  const formattedStartDate = startDate.format(YEAR_MONTH_DAY_FORMAT);
  const partialAdjustedMarketRent = calculatePartialAdjustedMarketRentWithNonVariableBakedFees(leaseTerm, marketRentMonthly);

  const rent = parseFloat(partialAdjustedMarketRent) + parseFloat(complimentaryItemsAmount);

  if (!isRevaPricingAsRms) {
    return {
      [formattedStartDate]: {
        endDate: startDate.add(100, 'years').format(YEAR_MONTH_DAY_FORMAT),
        rent,
      },
    };
  }

  return getPriceForMatrixAsRms({ startDate, rent });
};

export const parseDataSet = async (ctx, { propertyId, revaPricing, isRevaPricingAsRms }) => {
  logger.info({ ctx, propertyId }, 'REVA parseDataSet started');
  let parsingResults = [];

  try {
    logger.info({ ctx, propertyId, length: revaPricing.length }, 'Length of initial RevaPricing result');
    if (!revaPricing.length) {
      logger.error({ ctx, propertyId }, 'Reva Pricing length could not be zero');
      return { units: [], errors: [{ messages: [`No prices found for property: ${propertyId}`] }] };
    }

    const timezone = await getPropertyTimezone(ctx, propertyId);

    /** Each inventory is repeated by every lease term, in here we group them by inventory id. */
    const revaPricesGroupedById = groupBy(revaPricing, ({ id }) => id);
    const revaPricesGroupedByIdKeys = Object.keys(revaPricesGroupedById);
    logger.info({ ctx, propertyId, length: revaPricesGroupedByIdKeys.length }, 'RevaPricing grouped by inventory id');

    const inventoriesComplimentaryItems = await getComplimentsPriceByInventoryIds(ctx, revaPricesGroupedByIdKeys);
    const inventoryComplimentaryItemsMap = new Map(inventoriesComplimentaryItems.map(i => [i.inventoryId, i.basePriceMonthlyArray]));

    parsingResults = await reduce(
      revaPricesGroupedByIdKeys,
      async (prices, key) => {
        /** Each group is a list of inventory prices by lease term. */
        const inventoryPrices = revaPricesGroupedById[key];

        const complimentaryItems = inventoryComplimentaryItemsMap.get(key) ?? [];
        const complimentaryItemsAmount = complimentaryItems.reduce((acc, item) => acc + item, 0);

        const unitPrices = getUnitPrices(inventoryPrices, timezone);

        const leaseTerms = inventoryPrices.reduce(
          (acc, inventoryPrice) => {
            const { marketRentMonthly, termLength, relativeAdjustment, absoluteAdjustment, leaseState } = inventoryPrice;

            const startDate = now({ timezone });

            const priceForMatrix = getPriceForMatrix({
              startDate,
              marketRentMonthly,
              leaseTerm: {
                relativeAdjustment,
                absoluteAdjustment,
                concessions: [],
              },
              isRevaPricingAsRms,
              complimentaryItemsAmount,
            });

            if (!leaseState) {
              acc.newLeaseTerms = { ...acc.newLeaseTerms, [termLength]: priceForMatrix };
              acc.renewalLeaseTerms = { ...acc.renewalLeaseTerms, [termLength]: priceForMatrix };
            } else if (leaseState === DALTypes.LeaseState.RENEWAL) {
              acc.renewalLeaseTerms = { ...acc.renewalLeaseTerms, [termLength]: priceForMatrix };
            } else {
              acc.newLeaseTerms = { ...acc.newLeaseTerms, [termLength]: priceForMatrix };
            }

            return acc;
          },
          { renewalLeaseTerms: {}, newLeaseTerms: {} },
        );

        const formattedPrices = unitPrices.reduce((acc, unitPrice) => {
          if (unitPrice.renewalDate && !isEmpty(leaseTerms.renewalLeaseTerms)) {
            acc.push(buildUnitStructure(leaseTerms.renewalLeaseTerms, [], unitPrice, timezone));
          } else if (!unitPrice.renewalDate && !isEmpty(leaseTerms.newLeaseTerms)) {
            acc.push(buildUnitStructure(leaseTerms.newLeaseTerms, [], unitPrice, timezone));
          }
          return acc;
        }, []);

        prices.push(...formattedPrices);
        return prices;
      },
      [],
    );

    logger.info({ ctx, propertyId, length: parsingResults.length }, 'Length of parsed RevaPricing');
  } catch (error) {
    logger.error({ ctx, propertyId, error }, 'REVA parseDataSet has failed');
    parsingResults.push({ error: { messages: [error.message] } });
  }

  return {
    units: parsingResults.map(({ unitStructure }) => unitStructure),
    errors: parsingResults.filter(({ error }) => !!error),
  };
};

export const getPricing = async ctx => {
  logger.info({ ctx }, 'getPricing started');
  try {
    return (await getRevaPricing(ctx)) || [];
  } catch (error) {
    throwCustomError(RmsImportError.PARSING_FAILED_ERROR, [error]);
  }
  return [];
};

export const parseDataSetUsingPropertyId = async (ctx, propertyId, isRevaPricingAsRms, pricing) => {
  logger.info({ ctx, propertyId }, 'parseDataSetUsingPropertyId started');
  try {
    const revaPricing = pricing || (await getRevaPricingByPropertyId(ctx, propertyId)) || [];

    return await parseDataSet(ctx, { propertyId, revaPricing, isRevaPricingAsRms });
  } catch (error) {
    throwCustomError(RmsImportError.PARSING_FAILED_ERROR, [error]);
  }
  return { units: [], errors: [] };
};

export const parseDataSetUsingInventoryIds = async (ctx, propertyId, inventoryIds, isRevaPricingAsRms) => {
  logger.info({ ctx, inventoryIds }, 'parseDataSetUsingInventoryIds started');
  try {
    const revaPricing = (await getRevaPricingByInventoryIds(ctx, propertyId, inventoryIds)) || [];
    return await parseDataSet(ctx, { propertyId, revaPricing, isRevaPricingAsRms });
  } catch (error) {
    throwCustomError(RmsImportError.PARSING_FAILED_ERROR, [error]);
  }
  return { units: [], errors: [] };
};
