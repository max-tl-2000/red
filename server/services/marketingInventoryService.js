/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import loggerModule from '../../common/helpers/logger';
import { getAmenitiesByInventoryIds, getAmenitiesByPropertyId } from '../dal/amenityRepo';
import { getComplimentsForInventory, getPropertyTimezoneFromInventoryId, getInventoryProps } from '../dal/inventoryRepo';
import { getSourceByName } from '../dal/sourcesRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { getRankedUnits } from '../dal/searchRepo';
import { getAssetUrlsByEntityId } from './assets';
import { parseAsInTimezone, now, toMoment } from '../../common/helpers/moment-utils';
import { getPricingForInventory } from '../dal/rmsPricingRepo';
import { getPropertyTimezoneAndSettingsFromInventoryId } from '../dal/propertyRepo';
import { getMarketingAssetsByInventoryId } from '../dal/marketingAssetsRepo';
import { ServiceError } from '../common/errors';
import { getLeaseTermsByPropertyIds, getLeaseTermsByInventoryId } from '../dal/leaseTermRepo';
import { getMarketingQuestionsByInventoryId } from '../dal/marketingQuestionsRepo';
import { flattenedUnits } from './search';
import { getMatrixLeaseRentData, searchLowestPriceInClosestRanges } from '../../common/helpers/quotes';
import { YEAR_MONTH_DAY_FORMAT } from '../../common/date-constants';
import { isInventoryOnHold } from './inventories';
import { getAdditionalOneTimeFeesByPeriod } from '../dal/feeRepo';
import { getExtendedPropertyInformation } from './marketingPropertiesService';
import { getMarketingLayoutsDetails } from '../dal/marketingLayoutsRepo';
import { formatAssetUrl } from '../workers/upload/uploadUtil';
import { formatPhoneToDisplay } from '../../common/helpers/phone/phone-helper';
import { isDateInTheFuture, isDateAfterDate, isDateBeforeDate } from '../../common/helpers/date-utils';
import { getPropertyTimezone } from './properties';
import { removeEmptyElementsFromArray } from '../../common/helpers/utils';
import { isAvailableNow, getAvailabilityDate } from '../../common/helpers/inventory';
import { computeLeaseStartDateForQuote } from '../helpers/quotes';

const logger = loggerModule.child({ subType: 'marketingInventory' });

const availabilityDateIsEstimated = inventory => !inventory.availabilityDate;

const getInventoryBaseInfo = (inventory, timezone) => ({
  inventoryId: inventory.id,
  name: inventory.name,
  description: inventory.description,
  marketRent: inventory.marketRent,
  lossLeaderUnit: inventory.lossLeaderUnit,
  state: inventory.state,
  availabilityDate: getAvailabilityDate(inventory, timezone),
  isAvailableNow: isAvailableNow(inventory, timezone),
  availabilityDateIsEstimated: availabilityDateIsEstimated(inventory),
  fullQualifiedName: inventory.fullQualifiedName,
  lowestMonthlyRent: inventory.lowestMonthlyRent,
  buildingQualifiedName: `${inventory.buildingName}-${inventory.name}`,
});

const getImageUrlsForInventory = async (ctx, inventoryId) => {
  const imageUrls = await getAssetUrlsByEntityId(ctx, { entityId: inventoryId, assetType: DALTypes.AssetType.INVENTORY, getMetadata: true });
  const imageUrl = imageUrls[0]?.url || '';

  return { imageUrls, imageUrl };
};

export const sortInventoryAvailabilityDateAndState = (a, b) => {
  if (a.lossLeaderUnit) return -2;
  if (!a.availabilityDate && a.state !== DALTypes.InventoryState.VACANT_READY) return 1;
  let dateSort = 0;

  if (isDateBeforeDate(a.availabilityDate, b.availabilityDate, 'seconds')) {
    dateSort = -1;
  } else if (isDateAfterDate(a.availabilityDate, b.availabilityDate, 'seconds')) {
    dateSort = 1;
  }

  // TODO: is this correct? we're substracting booleans. I kept this because it returns a number but we should revisit this
  return (b.state === DALTypes.InventoryState.VACANT_READY) - (a.state === DALTypes.InventoryState.VACANT_READY) || dateSort;
};

export const getMarketingInventoriesWithDetails = async (ctx, filters, inventoryFormatter = getInventoryBaseInfo) => {
  const rankedUnits = await getRankedUnits(ctx, filters);
  const inventories = await flattenedUnits(ctx, rankedUnits);

  return await mapSeries(inventories.sort(sortInventoryAvailabilityDateAndState), async inv => ({
    ...inventoryFormatter(inv, await getPropertyTimezone(ctx, inv.propertyId)),
    ...(await getImageUrlsForInventory(ctx, inv.id)),
    amenities: await getAmenitiesByInventoryIds(ctx, [inv.id]),
    complimentaryItems: await getComplimentsForInventory(ctx, inv),
  }));
};

export const respondToMarketingInventoryRequest = async (ctx, inventoryId) => {
  logger.trace({ ctx, inventoryId }, 'handling marketing inventory request');
  const unitWithDetails = (await getMarketingInventoriesWithDetails(ctx, { inventoryIds: [inventoryId] }))[0];
  if (!unitWithDetails) {
    logger.trace({ ctx, inventoryId }, 'unable to load marketing details for inventory');
    throw new ServiceError({ token: 'INVENTORY_NOT_FOUND', status: 404 });
  }
  const unitMarketingAssets = await getMarketingAssetsByInventoryId(ctx, inventoryId);
  const videoUrls = unitMarketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.VIDEO);
  unitWithDetails['3DUrls'] = unitMarketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.THREE_D);
  return { ...unitWithDetails, videoUrls };
};

const getLeaseTermsWithPrice = (rentMatrix, { leaseTermsLengths, selectedDate, leaseTermsWithNewState, getClosestRange, timezone }) =>
  leaseTermsLengths.reduce(
    (leaseTermsData, leaseTermLength) => {
      if (!leaseTermsWithNewState.some(({ termLength }) => termLength === leaseTermLength)) return leaseTermsData;

      const leaseTermFromMatrix = rentMatrix[leaseTermLength];

      if (!leaseTermFromMatrix) return leaseTermsData;
      // This function search for the overlapping price using the given date
      const { date: closestPriceDate, leaseRentData: rentData } = getMatrixLeaseRentData(leaseTermFromMatrix, selectedDate, getClosestRange);
      if (!rentData) return leaseTermsData;

      const startDates = Object.keys(leaseTermFromMatrix);
      const startDate = closestPriceDate || selectedDate;
      const lowestRentInTerm = searchLowestPriceInClosestRanges(startDates, leaseTermFromMatrix, startDate, now({ timezone })) || {};

      const termPeriod = leaseTermsWithNewState.find(lt => lt.termLength === leaseTermLength)?.period;

      leaseTermsData.leaseTerms.push({
        marketRent: Math.round(rentData.rent),
        termLength: leaseTermLength,
        period: termPeriod || '',
        closestLowestRent: {
          moveInDate: lowestRentInTerm.endDate,
          marketRent: lowestRentInTerm.rent,
        },
      });

      leaseTermsData.date = startDate;

      return leaseTermsData;
    },
    { leaseTerms: [] },
  );

const getMoveInDate = (moveInDate, timezone) => (moveInDate ? parseAsInTimezone(moveInDate, { timezone }).startOf('day') : now({ timezone }).startOf('day'));

const getAdditionalTerms = async (rentMatrix, { leaseTermsLengths, selectedDate, leaseTermsWithNewState, timezone }) => {
  const additionalTermKeys = Object.keys(rentMatrix)
    .map(rp => parseInt(rp, 10))
    .filter(k => !leaseTermsLengths.some(lt => lt === k));

  const { leaseTerms } = getLeaseTermsWithPrice(rentMatrix, {
    leaseTermsLengths: additionalTermKeys,
    selectedDate,
    leaseTermsWithNewState,
    getClosestRange: true,
    timezone,
  });

  return leaseTerms;
};

export const respondToMarketingInventoryPricing = async (ctx, inventoryId, moveInDate, validatePastDate = true) => {
  logger.trace({ ctx, inventoryId, moveInDate }, 'respondToMarketingInventoryPricing: handling marketing inventory pricing request');

  if (await isInventoryOnHold(ctx, inventoryId)) throw new ServiceError({ token: 'INVENTORY_ON_HOLD', status: 412 });

  const { id: propertyId, timezone, settings: propertySettings } = await getPropertyTimezoneAndSettingsFromInventoryId(ctx, inventoryId);

  const {
    marketing: { selfServeDefaultLeaseLengthsForUnits: leaseTermsLengths, selfServeAllowExpandLeaseLengthsForUnits: expandLease },
  } = propertySettings;

  if (!(leaseTermsLengths?.length > 0)) {
    logger.error({ ctx, inventoryId }, 'respondToMarketingInventoryPricing: selfServeDefaultLeaseLengthsForUnits is not defined in property settings');
    throw new ServiceError({ token: 'MISSING_DEFAULT_LEASE_LENGTHS', status: 404 });
  }

  if (validatePastDate && now({ timezone }).isAfter(parseAsInTimezone(moveInDate, { timezone }), 'day')) {
    logger.warn({ ctx, timezone, inventoryId, moveInDate }, 'respondToMarketingInventoryPricing: the date is in the past');
    throw new ServiceError({ token: 'MISSING_INVENTORY_PRICING', status: 404 });
  }

  const moveInDateMoment = getMoveInDate(moveInDate, timezone);
  const inventory = await getInventoryProps(ctx, { inventoryId });
  const availabilityDate = computeLeaseStartDateForQuote(moveInDateMoment, { propertySettings, inventory });

  const pricing = await getPricingForInventory(ctx, inventoryId);
  if (!pricing) {
    logger.warn({ ctx, inventoryId }, 'respondToMarketingInventoryPricing: could not find inventory pricing in rms table');
    throw new ServiceError({ token: 'MISSING_INVENTORY_PRICING', status: 404 });
  }

  const leaseTermsForProperty = await getLeaseTermsByPropertyIds(ctx, [propertyId]);
  // If lease state is null then it means is applicable for both renewal and new.
  const leaseTermsWithNewState = leaseTermsForProperty.filter(lt => lt.state === DALTypes.LeaseState.NEW || !lt.state);

  const selectedDate = availabilityDate.format(YEAR_MONTH_DAY_FORMAT);
  const { date, leaseTerms: terms } = getLeaseTermsWithPrice(pricing.rentMatrix, {
    leaseTermsLengths,
    selectedDate,
    leaseTermsWithNewState,
    getClosestRange: true,
    timezone,
  });

  if (!expandLease) {
    if (terms.length === 0) {
      logger.warn({ ctx, expandLease, inventoryId }, 'respondToMarketingInventoryPricing: term list is empty');
      throw new ServiceError({ token: 'MISSING_INVENTORY_PRICING', status: 404 });
    }
    return { date, terms };
  }

  const additionalTerms = await getAdditionalTerms(pricing.rentMatrix, { leaseTermsLengths, selectedDate, leaseTermsWithNewState, timezone });
  return { date, terms, additionalTerms };
};

const getFeeInfo = (marketingQuestionId, inventoryFees) => {
  const fee = inventoryFees.find(f => f.marketingQuestionId === marketingQuestionId) || {};
  return {
    feeId: fee.id,
    maxQuantity: fee.maxQuantityInQuote,
  };
};

export const respondToMarketingInventoryQuoteQuestions = async (ctx, inventoryId) => {
  logger.trace({ ctx, inventoryId }, 'handling marketing quote questions request');

  const allMarketingQuestionsForInventory = await getMarketingQuestionsByInventoryId(ctx, inventoryId);
  const propertyTimezone = await getPropertyTimezoneFromInventoryId(ctx, inventoryId);
  const leaseTerms = await getLeaseTermsByInventoryId(ctx, inventoryId);
  const inventoryFees = await getAdditionalOneTimeFeesByPeriod(ctx, { inventoryId, leaseTerms, propertyTimezone });
  const monthlyInventoryFees = inventoryFees?.find(f => f.name === 'month')?.fees;

  const marketingQuestions = [];
  await mapSeries(allMarketingQuestionsForInventory, async mq => {
    const feeInfo = getFeeInfo(mq.id, monthlyInventoryFees);
    feeInfo.feeId && marketingQuestions.push({ ...mq, ...feeInfo });
  });

  return marketingQuestions;
};

const allowPetsAmenities = ['petfriendly', 'petarea', 'petgroomingarea', 'petfriendlydogpark', 'petfriendlydogparkonsite'];
const garageIncludedAmenities = ['garageincluded'];
const garageAvailableAmenities = ['garageavailable'];
const includesWasherDryerAmenities = ['washerdryerincluded', 'washeranddryerincluded', 'washerdryerprovided', 'washeranddryerinunit'];

const hasAmenity = (requestedAmenities, availableAmenities) => availableAmenities.some(am => requestedAmenities.includes(am.toLowerCase()));

const checkRequestedAmenities = (entityAmenities, propertyAmenities) => {
  const petFriendly = hasAmenity(allowPetsAmenities, [...entityAmenities, ...propertyAmenities]);
  const garageIncluded = hasAmenity(garageIncludedAmenities, entityAmenities);
  const garageAvailable = hasAmenity(garageAvailableAmenities, [...entityAmenities, ...propertyAmenities]);
  const includesWasherDryer = hasAmenity(includesWasherDryerAmenities, entityAmenities);

  // TODO: this should be coming from columns in the spreadsheet for inventory and layouts: https://redisrupt.atlassian.net/browse/CPM-15591
  const allowed = [];
  const included = [];
  const available = [];

  if (petFriendly) {
    allowed.push('cats', 'dogs');
  }

  if (garageIncluded) {
    included.push('garage');
  }
  if (includesWasherDryer) {
    included.push('washer', 'dryer');
  }

  if (garageAvailable) {
    available.push('garage');
  }

  return {
    allowed,
    included,
    available,
  };
};

const extractAmenityNames = amenities =>
  amenities.reduce(
    ([names, displayNames], { name, displayName }) => {
      names.push(name);
      displayNames.push(displayName);
      return [names, displayNames];
    },
    [[], []],
  );

const formatPropertyDetails = property => {
  const addressObj = property?.address;

  const address = {
    addressLine1: addressObj?.addressLine1,
    addressLine2: addressObj?.addressLine2,
    city: addressObj?.city,
    state: addressObj?.state,
    postalCode: addressObj?.zip || addressObj?.postalCode,
  };

  return {
    name: property.displayName,
    propertyId: property.propertyId,
    address,
    formattedAddress: property.formattedLongAddress,
    officeHours: property.team.hours,
    timezone: property.timezone,
    phone: property.phone,
    displayPhone: formatPhoneToDisplay(property.phone),
    email: property.email,
    images: property.images,
    url: property.url,
  };
};

const formatInventoryDetails = async (ctx, inventoryDetails, propertyAmenities, timezone) => {
  const [inventoryAmenityNames, inventoryAmenityDisplayNames] = extractAmenityNames(inventoryDetails.amenities);
  const { allowed, included, available } = checkRequestedAmenities(inventoryAmenityNames, propertyAmenities);

  const retVal = {
    unitRentPrice: inventoryDetails.marketRent, // TODO: we should probably use the adjustedMarketRent here and not market Rent. Same below. It should include the baked-in adjustments
    minRentPrice: inventoryDetails.lowestMonthlyRent,
    numBathrooms: inventoryDetails.layoutNoBathrooms,
    numBedrooms: inventoryDetails.layoutNoBedrooms,
    surfaceArea: inventoryDetails.layoutSurfaceArea,
    description: inventoryDetails.description,
    // should we add a shortDescription?
    // shortDescription: inventoryDetails.shortDescription,
    name: inventoryDetails.unitName,
    images: (inventoryDetails.imageUrls || []).map(({ url, metadata = {} }) => ({ url, caption: metadata.label, floorPlan: metadata.floorPlan })),
    amenities: inventoryAmenityDisplayNames,
    inventoryId: inventoryDetails.id,
    isAvailable: !!inventoryDetails.availabilityDate,
    externalId: inventoryDetails.externalId,
    address: inventoryDetails.address,
    propertyId: inventoryDetails.propertyId,
    allowed,
    included,
    available,
  };

  if (retVal.isAvailable && isDateInTheFuture(inventoryDetails.availabilityDate, timezone)) {
    retVal.availableDate = inventoryDetails.availabilityDate;
    retVal.formattedAvailableDate = toMoment(inventoryDetails.availabilityDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT);
  }

  return retVal;
};

const formatLayoutDetails = async (ctx, layout, propertyAmenities, timezone) => {
  const layoutAmenities = await getAmenitiesByInventoryIds(ctx, layout.inventoryIds);
  const [layoutAmenityNames, layoutAmenityDisplayNames] = extractAmenityNames(layoutAmenities);
  const { allowed, included, available } = checkRequestedAmenities(layoutAmenityNames, propertyAmenities);

  const ret = {
    marketingLayoutId: layout.id,
    numBathrooms: layout.numBathrooms,
    numBedrooms: layout.numBedrooms,
    minSurfaceArea: layout.minSurfaceArea,
    maxSurfaceArea: layout.maxSurfaceArea,
    name: layout.displayName,
    description: layout.description,
    layoutImage: layout.assetId && formatAssetUrl(ctx.tenantId, layout.assetId),
    amenities: layoutAmenityDisplayNames,
    propertyId: layout.propertyId,
    allowed,
    included,
    available,
    minRent: layout.minRent,
    hasAvailability: !!layout.minAvailableDate,
  };

  if (ret.hasAvailability && isDateInTheFuture(layout.minAvailableDate, timezone)) {
    ret.minAvailableDate = toMoment(layout.minAvailableDate, { timezone }).toISOString();
  }

  return ret;
};

export const respondToMarketingInventoryAndLayoutRequest = async (ctx, { inventoryIds, marketingLayoutIds, source, asArray } = {}) => {
  logger.trace({ ctx, inventoryIds, layoutIds: marketingLayoutIds }, 'handling respondToMarketingInventoryAndLayoutRequest request');

  if (!source) {
    throw new ServiceError({ token: 'MISSING_SOURCE', status: 400 });
  }

  const validSource = await getSourceByName(ctx, source);
  if (!validSource) {
    throw new ServiceError({ token: 'INVALID_SOURCE', status: 400 });
  }

  const sanitizedInventoryIds = removeEmptyElementsFromArray(inventoryIds);
  const sanitizedMarketingLayoutIds = removeEmptyElementsFromArray(marketingLayoutIds);

  if (
    (inventoryIds && !Array.isArray(inventoryIds)) ||
    (marketingLayoutIds && !Array.isArray(marketingLayoutIds)) ||
    (!sanitizedInventoryIds?.length && !sanitizedMarketingLayoutIds?.length)
  ) {
    throw new ServiceError({ token: 'MISSING_INVENTORY_IDS_OR_LAYOUT_IDS', status: 400 });
  }

  inventoryIds = Array.from(new Set(sanitizedInventoryIds));
  marketingLayoutIds = Array.from(new Set(sanitizedMarketingLayoutIds));

  let inventories = [];
  let layouts = [];

  if (inventoryIds.length > 0) {
    inventories = await getMarketingInventoriesWithDetails(ctx, { inventoryIds, limit: inventoryIds.length }, inv => inv);
  }

  if (marketingLayoutIds.length > 0) {
    layouts = await getMarketingLayoutsDetails(ctx, { layoutIds: marketingLayoutIds });
  }

  let propertiesHash = inventories.reduce((acc, inventory) => {
    if (!acc[inventory.propertyId]) {
      acc[inventory.propertyId] = {};
    }

    if (!acc[inventory.propertyId].inventories) {
      acc[inventory.propertyId].inventories = [];
    }

    acc[inventory.propertyId].inventories.push(inventory);

    return acc;
  }, {});

  propertiesHash = layouts.reduce((acc, layout) => {
    if (!acc[layout.propertyId]) {
      acc[layout.propertyId] = {};
    }

    if (!acc[layout.propertyId].layouts) {
      acc[layout.propertyId].layouts = [];
    }

    acc[layout.propertyId].layouts.push(layout);
    return acc;
  }, propertiesHash);

  const retValAsObj = {};

  // TODO: when merged upstream this should use execConcurrent
  await mapSeries(Object.keys(propertiesHash), async propertyId => {
    const property = await getExtendedPropertyInformation(ctx, { propertyId, source, includeImages: true });
    const propertyAmenities = await getAmenitiesByPropertyId(ctx, property.propertyId);
    const propertyAmenityNames = propertyAmenities.map(amenity => amenity.name);
    const timezone = property.timezone;

    const inventoriesToFormat = propertiesHash[propertyId]?.inventories || [];

    const formattedInventories = await mapSeries(inventoriesToFormat, async unit => await formatInventoryDetails(ctx, unit, propertyAmenityNames, timezone));

    const layoutsToFormat = propertiesHash[propertyId]?.layouts || [];
    const formattedLayouts = await mapSeries(layoutsToFormat, async ml => await formatLayoutDetails(ctx, ml, propertyAmenityNames, timezone));

    const formattedProperty = formatPropertyDetails(property);

    if (!asArray) {
      retValAsObj.properties = retValAsObj.properties || {};

      retValAsObj.properties[propertyId] = formattedProperty;

      if (formattedLayouts.length > 0) {
        retValAsObj.marketingLayouts = retValAsObj.marketingLayouts || {};
        retValAsObj.marketingLayouts = {
          ...retValAsObj.marketingLayouts,
          ...formattedLayouts.reduce((acc, mktLayout) => {
            acc[mktLayout.marketingLayoutId] = mktLayout;
            return acc;
          }, {}),
        };
      }

      if (formattedInventories.length > 0) {
        retValAsObj.inventories = retValAsObj.inventories || {};
        retValAsObj.inventories = {
          ...retValAsObj.inventories,
          ...formattedInventories.reduce((acc, inventory) => {
            acc[inventory.inventoryId] = inventory;
            return acc;
          }, {}),
        };
      }
    } else {
      retValAsObj.properties = retValAsObj.properties || [];

      retValAsObj.properties.push(formattedProperty);

      if (formattedLayouts.length > 0) {
        retValAsObj.marketingLayouts = retValAsObj.marketingLayouts || [];
        retValAsObj.marketingLayouts = [...retValAsObj.marketingLayouts, ...formattedLayouts];
      }

      if (formattedInventories.length > 0) {
        retValAsObj.inventories = retValAsObj.inventories || [];
        retValAsObj.inventories = [...retValAsObj.inventories, ...formattedInventories];
      }
    }
  });

  return retValAsObj;
};
