/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getConcessionsByLeaseState, getConcessionsByIds } from '../dal/concessionRepo';
import { getOne } from '../database/factory';
import { getInventoryAmenities } from '../dal/inventoryRepo';
import { dateInBetween } from '../../common/helpers/date-utils';
import { now, toMoment } from '../../common/helpers/moment-utils';
import { getConcessionValue, updateFeesAmount } from '../../common/helpers/quotes';
import { getPropertyTimezone } from '../dal/propertyRepo';
import { getPriceUsingFloorCeiling } from '../../common/helpers/fee';
import logger from '../../common/helpers/logger';

const matchElement = (matchingCriterias, element) => {
  const match = !matchingCriterias ? true : matchingCriterias.find(filter => filter === element);
  return match;
};

const matchesLeaseNames = (concessionLeaseNamesIds, leaseNameId) => matchElement(concessionLeaseNamesIds, leaseNameId);

const matchesLeaseLengths = (concessionMinLeaseLength, concessionMaxLeaseLength, leaseTermLength) =>
  leaseTermLength >= (concessionMinLeaseLength || -1) && leaseTermLength <= (concessionMaxLeaseLength || 99999);

const matchesLayouts = (concessionLayoutsIds, inventory) => matchElement(concessionLayoutsIds, inventory.layoutId);

const matchesBuildings = (concessionBuildingsIds, inventory) => matchElement(concessionBuildingsIds, inventory.buildingId);

const matchesAmenities = (concessionAmenitiesIds, inventoryAmenities) => {
  const amenityMatch = !concessionAmenitiesIds ? true : concessionAmenitiesIds.find(amenityId => inventoryAmenities.find(amenity => amenity.id === amenityId));
  return amenityMatch;
};

const filterInactiveConcessions = (ctx, createdAt, leaseTerm, concessions, inventoryAmenities, inventory, timezone) =>
  concessions.filter(concession => {
    let concessionMinLeaseLength = false;
    let concessionMaxLeaseLength = false;
    let concessionLeaseNameIds = false;
    let concessionLayoutIds = false;
    let concessionBuildingIds = false;
    let concessionAmenityIds = false;
    const startDate = concession.startDate && toMoment(concession.startDate, { timezone }).startOf('day');
    const endDate = concession.endDate && toMoment(concession.endDate, { timezone }).endOf('day');
    const dateToCompare = createdAt && toMoment(createdAt, { timezone }).startOf('day');

    if (concession.matchingCriteria) {
      const matchingCriteria = JSON.parse(concession.matchingCriteria);
      concessionLeaseNameIds = matchingCriteria.leaseNames;
      concessionMinLeaseLength = matchingCriteria.minLeaseLength;
      concessionMaxLeaseLength = matchingCriteria.maxLeaseLength;
      concessionLayoutIds = matchingCriteria.layouts;
      concessionBuildingIds = matchingCriteria.buildings;
      concessionAmenityIds = matchingCriteria.amenities;
    }

    return (
      matchesLeaseNames(concessionLeaseNameIds, leaseTerm.leaseNameId) &&
      matchesLeaseLengths(concessionMinLeaseLength, concessionMaxLeaseLength, leaseTerm.termLength) &&
      matchesLayouts(concessionLayoutIds, inventory) &&
      matchesBuildings(concessionBuildingIds, inventory) &&
      matchesAmenities(concessionAmenityIds, inventoryAmenities) &&
      dateInBetween(startDate, endDate, dateToCompare)
    );
  });

export const getConcessionsForLeaseTerms = async (ctx, { leaseTermsMap, inventory, amenities, createdAt, timezone, leaseState }) => {
  logger.trace(
    {
      ctx,
      leaseTermsMap,
      inventoryId: inventory?.id,
      amenityIds: amenities?.map(amenity => amenity.id).join(', '),
      timezone,
      leaseState,
    },
    'getConcessionsForLeaseTerms',
  );

  const leaseTermsIds = new Array(...leaseTermsMap.keys());
  const concessionsByLeaseTerms = await getConcessionsByLeaseState(ctx, leaseTermsIds, inventory.inventoryGroupId, leaseState);

  return concessionsByLeaseTerms.map(({ leaseTermId, concessions }) => {
    const activeConcessions = filterInactiveConcessions(ctx, createdAt, leaseTermsMap.get(leaseTermId), concessions, amenities, inventory, timezone);
    logger.trace({ ctx, leaseTermId, activeConcessionIds: activeConcessions?.map(ac => ac.id).join(', ') }, 'activeConcessions found');

    return { leaseTermId, concessions: activeConcessions };
  });
};

export const getActiveConcessionsFromLeaseTerms = async (ctx, leaseTerms, amenities, inventory, createdAt, leaseState) => {
  logger.trace(
    { ctx, leaseTermIds: leaseTerms.map(leaseTerm => leaseTerm.id), inventoryId: inventory?.id, quoteCreatedAt: createdAt },
    'getActiveConcessionsFromLeaseTerms',
  );
  if (!leaseTerms?.length || !amenities?.length || !inventory) return [];
  const leaseTermConcessions = await getConcessionsByLeaseState(
    ctx,
    leaseTerms.map(term => term.id),
    inventory.inventoryGroupId,
    leaseState,
  );
  const timezone = await getPropertyTimezone(ctx, inventory.property.id);
  const filteredConcessions = leaseTermConcessions.map(leasetermConcessionsArray =>
    filterInactiveConcessions(ctx, createdAt, leasetermConcessionsArray.leaseTermId, leasetermConcessionsArray.concessions, amenities, inventory, timezone),
  );
  return filteredConcessions.flat();
};

export const getConcessionsByFilters = async (ctx, leaseTerm, inventoryId, createdAt, leaseState) => {
  logger.trace({ ctx, leaseTermId: leaseTerm?.id, inventoryId, quoteCreatedAt: createdAt }, 'getConcessionsByFilters');
  if (!leaseTerm?.id) return [];

  const inventory = await getOne(ctx, 'Inventory', inventoryId, {});
  const inventoryAmenities = await getInventoryAmenities(ctx, inventory);
  const leaseTermConcessions = await getConcessionsByLeaseState(ctx, [leaseTerm.id], inventory.inventoryGroupId, leaseState);
  const concessions = leaseTermConcessions[0]?.concessions || [];

  const timezone = await getPropertyTimezone(ctx, inventory.propertyId);
  return filterInactiveConcessions(ctx, createdAt, leaseTerm, concessions, inventoryAmenities, inventory, timezone);
};

export const getLeaseTermActiveConcessions = ({ ctx, createdAt, leaseTerm, concessions, inventoryAmenities, inventory, timezone }) =>
  filterInactiveConcessions(ctx, createdAt, leaseTerm, concessions, inventoryAmenities, inventory, timezone);

export const replacePeriodInConcessions = (period, concessions) =>
  concessions.map(concession => {
    if (concession.displayName.indexOf('%PERIOD%') > -1) {
      return {
        ...concession,
        displayName: concession.displayName.replace('%PERIOD%', period),
      };
    }
    return concession;
  });

const shouldConcessionBeConsidered = (date, startDate, endDate, { inclusive = true, timezone } = {}) =>
  dateInBetween(startDate, endDate, date, inclusive, timezone);

const filterCurrentlyValidConcessions = ({ allConcessions, currentFee, key, todayAtProperty, timezone }) =>
  allConcessions.filter(concession => {
    const { startDate, endDate } = concession;
    return concession.feeId === currentFee[key] && shouldConcessionBeConsidered(todayAtProperty, startDate, endDate, { timezone });
  });

export const updateConcessionsWithFloorCeilingAmount = leaseTermsOrFees =>
  leaseTermsOrFees.map(ltOrF => {
    ltOrF.concessions.forEach(c => {
      c.floorCeilingAmount = getPriceUsingFloorCeiling({
        floorCeilingFlag: c.adjustmentFloorCeiling,
        absolutePrice: c.absoluteAdjustment,
        relativePrice: c.relativeAdjustment,
        parentFeeAmount: ltOrF.adjustedMarketRent || ltOrF.price,
      });
    });
    return ltOrF;
  });

const alterFilteredConcessions = ({ allConcessions, period, todayAtProperty, fees, currentFee, key, timezone } = {}) => {
  let filteredConcessions = filterCurrentlyValidConcessions({ allConcessions, currentFee, key, todayAtProperty, timezone });
  filteredConcessions = replacePeriodInConcessions(period, filteredConcessions);
  currentFee.concessions = filteredConcessions;

  // Set concessions array to same fee
  fees.map(fee => {
    if (fee[key] === currentFee[key] && !fee.concessions) {
      fee.concessions = filteredConcessions;
      updateConcessionsWithFloorCeilingAmount([fee]);
    }
    return fee;
  });
};

/**
 * Filter the concessions per each fee using a range date validation
 * to get more details please check
 * @method getFeesWithFilteredConcessions
 * @param {object} ctx - database connection
 * @param {array} allConcessions - array of all concessions from database
 * @param {string} period - period, like month, week, day, hour
 * @param {string} inventoryId - id of the inventory
 * @param {array} fees - array of fees
 * @return {array} array of fees with concessions
 */
export const getFeesWithFilteredConcessions = async (ctx, { allConcessions, period, fees, propertyTimezone } = {}) => {
  const todayAtProperty = now({ timezone: propertyTimezone });

  return fees.map(currentFee => {
    if (!currentFee.concessions) {
      const key = currentFee.initialFeeId ? 'initialFeeId' : 'originalId';
      alterFilteredConcessions({ allConcessions, period, todayAtProperty, fees, currentFee, key, timezone: propertyTimezone });
    }
    return currentFee;
  });
};

export const setConcessionsAssociatedToFees = async (ctx, { allConcessions, period, fees = [], propertyTimezone }) =>
  updateFeesAmount(await getFeesWithFilteredConcessions(ctx, { allConcessions, period, fees, propertyTimezone }));

export const filterSelectedConcessions = (leaseTerms, selectedLeaseTerms) => {
  selectedLeaseTerms.forEach(selected => {
    const foundTerm = leaseTerms.find(term => selected.id === term.id) || {};
    foundTerm.concessions =
      Object.keys(foundTerm).length &&
      foundTerm.concessions.reduce((acc, concession) => {
        const tempConcession = selected.concessions.find(selectedConcession => selectedConcession.id === concession.id);

        if (tempConcession) {
          if (concession.variableAdjustment) {
            concession = {
              ...concession,
              amountVariableAdjustment: tempConcession.amountVariableAdjustment,
            };
          }

          concession.relativeAmount = tempConcession.relativeAmount;
          concession.variableAmountUpdatedByAgent = tempConcession.variableAmountUpdatedByAgent;
          concession.computedValue = getConcessionValue(
            concession,
            {
              amount: foundTerm.adjustedMarketRent,
              length: foundTerm.termLength,
            },
            true,
          );

          acc.push(concession);
        }

        return acc;
      }, []);
  });
};

export const mapSelectedLeaseTermsAndConcessions = (leaseTerms, selectedLeaseTerms) =>
  selectedLeaseTerms.reduce((acc, selected) => {
    const foundTerm = leaseTerms.find(term => selected.id === term.id);
    if (!foundTerm) return acc;

    foundTerm.concessions =
      Object.keys(foundTerm).length &&
      foundTerm.concessions.map(concession => {
        const selectedConcession = selected.concessions.some(sc => sc.id === concession.id);

        const additionalData = selectedConcession
          ? {
              computedValue: getConcessionValue(
                concession,
                {
                  amount: foundTerm.adjustedMarketRent,
                  length: foundTerm.termLength,
                },
                true,
              ),
              selected: true,
            }
          : {};

        return {
          ...concession,
          ...additionalData,
        };
      });

    acc.push(foundTerm);
    return acc;
  }, []);

export const filterLeaseTermsSelectedConcessions = (leaseTerms, selectedLeaseTerms) =>
  leaseTerms.map(lt => {
    const selectedLeaseTerm = selectedLeaseTerms.find(term => term.id === lt.id);
    const selectedConcessions = lt.concessions.filter(concession => selectedLeaseTerm.concessions.some(c => c.id === concession.id));

    return {
      ...lt,
      concessions: selectedConcessions,
    };
  });

export const getConcessionById = async (ctx, concessionId) => {
  const [result] = await getConcessionsByIds(ctx, [concessionId]);
  return result;
};
